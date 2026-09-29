import postgres from "postgres";

/**
 * Conexión de SOLO LECTURA al proyecto `olcxbtvjkjmofrbvzpat`, donde viven
 * CX Advisor (schema `core`) y Toolbox (`hw_staging`). De ahí se espejan los
 * clientes.
 *
 * Reutiliza el acceso que ya existe en el ecosistema en vez de montar uno
 * nuevo: misma variable `OLCX_DATABASE_URL` y mismo rol de solo lectura
 * (`qarvis_ro`) que usa Qarvis en `app/src/lib/db/external.ts`. El valor se
 * copia tal cual de las variables de entorno de Qarvis.
 *
 * No vale el acceso de QStatus Growth: ese va por MCP HTTP con un token de
 * lectura, que sirve para que un agente consulte a mano pero no para que un
 * servidor sincronice.
 *
 * Es una base ajena: HSM no la administra ni escribe en ella. El rol solo
 * necesita SELECT sobre `core.locations`.
 *
 * No se usa Drizzle a propósito: solo hace falta un SELECT y declarar aquí el
 * esquema entero de `core.locations` (60+ columnas, varias deprecadas y dos con
 * un punto en el nombre) sería una copia que envejecería sola.
 */

let _cx: ReturnType<typeof postgres> | null = null;

/** ¿Está configurada la conexión? Si no, el sync se salta sin romper nada. */
export function isCxAdvisorConfigured(): boolean {
  return !!process.env.OLCX_DATABASE_URL;
}

export function getCxAdvisorDb() {
  const url = process.env.OLCX_DATABASE_URL;
  if (!url) {
    throw new Error(
      "OLCX_DATABASE_URL no está configurada: no se puede sincronizar clientes."
    );
  }
  if (!_cx) {
    _cx = postgres(url, {
      prepare: false, // requerido por el pooler (Supavisor) en transaction mode
      max: 3, // el sync es un job puntual, no necesita más
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: "require",
      connection: {
        // El sync lee ~4.100 filas de una tabla ancha. 15 s se queda corto;
        // 60 s es de sobra y sigue acotando un cuelgue.
        statement_timeout: 60000,
      },
    });
  }
  return _cx;
}

/** Una location de CX Advisor, solo con lo que HSM necesita. */
export interface CxLocation {
  cxDealId: string;
  locationName: string;
  restaurantIdBackend: string | null;
  city: string | null;
  provincia: string | null;
  businessStage: string | null;
  email: string | null;
  intercomCompanyId: string | null;
}

/**
 * Trae TODAS las locations, incluidas las de baja ("0.b Lost Deal").
 *
 * Se traen las bajas a propósito: un cliente que se dio de baja puede seguir
 * teniendo hardware de Qamarero sin devolver, y soporte necesita poder abrirle
 * una incidencia o un RMA. En el buscador se marcan como baja, no se ocultan.
 */
export async function fetchCxLocations(): Promise<CxLocation[]> {
  const sql = getCxAdvisorDb();
  const rows = await sql<
    {
      cx_deal_id: string;
      location_name: string | null;
      restaurant_id_backend: string | null;
      city: string | null;
      provincia: string | null;
      business_stage: string | null;
      restaurant_primary_email: string | null;
      intercom_company_id: string | null;
    }[]
  >`
    SELECT hubspot_deal_id AS cx_deal_id,
           location_name,
           restaurant_id_backend,
           city,
           provincia,
           business_stage,
           restaurant_primary_email,
           intercom_company_id
      FROM core.locations
     WHERE location_name IS NOT NULL
       AND btrim(location_name) <> ''
  `;

  return rows.map((r) => ({
    cxDealId: r.cx_deal_id,
    locationName: cleanLocationName(r.location_name!),
    restaurantIdBackend: emptyToNull(r.restaurant_id_backend),
    city: emptyToNull(r.city),
    provincia: emptyToNull(r.provincia),
    businessStage: emptyToNull(r.business_stage),
    email: emptyToNull(r.restaurant_primary_email),
    intercomCompanyId: emptyToNull(r.intercom_company_id),
  }));
}

/**
 * Quita los prefijos con que HubSpot nombra las locations. Es ruido del CRM:
 * quien busca escribe "Green Planet", no "CX - S: Green Planet".
 *
 * Son dos y pueden venir encadenados:
 *   "CX - "  en unos dos tercios de la cartera
 *   "S: "    en 1.067 locations (26%), medido sobre la base
 *
 * El segundo apareció al comparar los que no casaban: "Sukaldea Atotxa" en HSM
 * contra "CX - S: Sukaldea Atotxa" en CX Advisor. Sin quitarlo, ese cuarto de
 * la cartera no casa por nombre y se duplica.
 *
 * NO se tocan "Restaurante", "Bar" ni "Cafetería", que también encabezan
 * muchos nombres: ahí sí suelen ser parte del nombre real del negocio.
 */
export function cleanLocationName(raw: string): string {
  const limpio = raw
    .replace(/^\s*CX\s*[-–—]\s*/i, "")
    .replace(/^\s*S\s*:\s*/i, "")
    .trim();
  return limpio || raw.trim();
}

function emptyToNull(v: string | null): string | null {
  const t = v?.trim();
  return t ? t : null;
}
