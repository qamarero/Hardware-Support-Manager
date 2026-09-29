import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { isNull, isNotNull, sql } from "drizzle-orm";
import { fetchCxLocations, cleanLocationName, type CxLocation } from "@/lib/db/cx-advisor";
import { INTERCOM_APP_ID } from "@/lib/utils/intercom-url";

export interface SyncClientsResult {
  simulacion: boolean;
  leidos: number;
  adoptados: number;
  insertados: number;
  actualizados: number;
  /** Desglose del casado: por restaurant_id y, si no, por nombre normalizado. */
  adoptadosPorId: number;
  adoptadosPorNombre: number;
  /** Clientes de HSM que no casan ni por id ni por nombre. Cada uno acabará
   *  conviviendo con la ficha nueva: son los duplicados a revisar. */
  huerfanosSinPareja: number;
  /** Muestra de esos huérfanos, para poder mirarlos a ojo antes de decidir. */
  ejemplosHuerfanos: string[];
  duracionMs: number;
}

/** Postgres admite 65535 parámetros por sentencia; 500 filas × 10 columnas cabe de sobra. */
const LOTE = 500;

/**
 * Espeja los clientes de CX Advisor en `hsm.clients`.
 *
 * Qué NO toca, y por qué: `notes`, `contact_name`, `phone` y `address` los
 * escribe el equipo de soporte y no existen en CX Advisor, así que el sync los
 * deja intactos aunque la fila venga de allí. Y las filas con
 * `source = 'manual'` que no casen con ninguna location no se tocan en
 * absoluto — nadie pierde lo que dio de alta a mano.
 */
export async function syncClientsFromCxAdvisor(
  opciones: { dryRun?: boolean } = {}
): Promise<SyncClientsResult> {
  const { dryRun = false } = opciones;
  const t0 = Date.now();
  const locations = await fetchCxLocations();

  // Los cx_deal_id que YA están en la tabla. Hay que pasárselos al plan, no
  // solo contarlos: si un huérfano casa con un deal que ya tiene dueño, el
  // índice único rechaza el UPDATE y tumba el lote entero. Pasa en cuanto el
  // sync se ejecuta por segunda vez, o después de una ejecución a medias.
  const yaEspejados = await cxDealIdsExistentes();
  const plan = await planificarAdopcion(locations, yaEspejados);

  if (dryRun) {
    // Cuántas locations todavía no tienen ficha: las que no adopta nadie y
    // cuyo cx_deal_id no está ya en la tabla.
    const cubiertos = new Set([...yaEspejados, ...plan.pares.map((p) => p.cxDealId)]);
    const insertaria = locations.filter((l) => !cubiertos.has(l.cxDealId)).length;
    return {
      simulacion: true,
      leidos: locations.length,
      adoptados: plan.pares.length,
      adoptadosPorId: plan.porRestaurantId,
      adoptadosPorNombre: plan.porNombre,
      insertados: insertaria,
      actualizados: locations.length - insertaria,
      huerfanosSinPareja: plan.huerfanosSinPareja.length,
      ejemplosHuerfanos: plan.huerfanosSinPareja.slice(0, 15),
      duracionMs: Date.now() - t0,
    };
  }

  await aplicarAdopcion(plan.pares);

  const antes = await contarEspejados();
  for (let i = 0; i < locations.length; i += LOTE) {
    await upsertLote(locations.slice(i, i + LOTE));
  }
  const despues = await contarEspejados();

  const insertados = Math.max(0, despues - antes);
  return {
    simulacion: false,
    leidos: locations.length,
    adoptados: plan.pares.length,
    adoptadosPorId: plan.porRestaurantId,
    adoptadosPorNombre: plan.porNombre,
    insertados,
    actualizados: locations.length - insertados,
    huerfanosSinPareja: plan.huerfanosSinPareja.length,
    ejemplosHuerfanos: plan.huerfanosSinPareja.slice(0, 15),
    duracionMs: Date.now() - t0,
  };
}

/**
 * Casa los clientes que ya existían con su location antes de insertar nada.
 *
 * Sin este paso, el primer sync duplicaría a todo cliente dado de alta a mano
 * que además estuviera en CX Advisor: el upsert va por `cx_deal_id`, que esas
 * filas todavía no tienen, así que insertaría una segunda ficha del mismo
 * restaurante. Se casa por `external_id` (el restaurant_id de Qamarero), que
 * es el único identificador que comparten ambos lados.
 */
interface PlanAdopcion {
  pares: { id: string; cxDealId: string }[];
  porRestaurantId: number;
  porNombre: number;
  /** Nombres de clientes de HSM que no casan ni por id ni por nombre. */
  huerfanosSinPareja: string[];
}

/**
 * Nombre comparable entre las dos bases.
 *
 * Hace falta porque los mismos restaurantes están escritos distinto en cada
 * lado: "La Bella Caffé Tejeringos" contra "La Bella Caffe Tejeringos" (un
 * acento) y "La esquina del buen sabor" contra "La Esquina del Buen Sabor"
 * (mayúsculas). Sin normalizar, esos casan por nombre y se duplican.
 */
export function normalizarNombre(raw: string): string {
  return cleanLocationName(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ") // signos, guiones, apóstrofes
    .trim();
}

async function planificarAdopcion(
  locations: CxLocation[],
  yaEnLaTabla: Set<string>
): Promise<PlanAdopcion> {
  const porRestaurantId = new Map<string, string>();
  for (const l of locations) {
    if (l.restaurantIdBackend) {
      // trim() no es cosmético: en CX Advisor hay restaurant_id_backend con un
      // tabulador pegado al final (p. ej. el de "CX - Canela en rama"). Sin
      // limpiarlo, esos clientes no casan y se duplican.
      porRestaurantId.set(l.restaurantIdBackend.trim().toLowerCase(), l.cxDealId);
    }
  }

  // Todos los clientes sin cx_deal_id, tengan external_id o no: los que no lo
  // tienen también pueden casar por nombre.
  const huerfanos = await db
    .select({ id: clients.id, name: clients.name, externalId: clients.externalId })
    .from(clients)
    .where(isNull(clients.cxDealId));

  const pares: { id: string; cxDealId: string }[] = [];
  // Arranca con los deals que YA tienen dueño en la tabla, no vacío. Un mismo
  // restaurant_id puede estar repetido en hsm.clients (fichas duplicadas de la
  // importación antigua), y un deal solo puede pertenecer a una ficha: el
  // índice único rechaza la segunda y tumba el lote entero.
  const yaAsignados = new Set<string>(yaEnLaTabla);
  const sinCasarPorId: typeof huerfanos = [];

  // ── Pase 1: por restaurant_id, que es un identificador de verdad ──
  for (const c of huerfanos) {
    const cxDealId = porRestaurantId.get((c.externalId ?? "").trim().toLowerCase());
    if (!cxDealId || yaAsignados.has(cxDealId)) {
      // También cuando el deal ya tiene dueño: esa ficha es un duplicado
      // interno y conviene que salga en el recuento de huérfanos, no que
      // desaparezca del informe sin dejar rastro.
      sinCasarPorId.push(c);
      continue;
    }
    yaAsignados.add(cxDealId);
    pares.push({ id: c.id, cxDealId });
  }
  const porRestaurantIdCount = pares.length;

  // ── Pase 2: por nombre normalizado ──
  // Manda CX Advisor, así que un restaurante que allí tiene otro restaurant_id
  // debe quedarse con UNA ficha, no con dos. Casar por nombre recupera esos
  // casos y conserva la ficha de HSM con sus incidencias y RMA enlazados.
  //
  // Solo se casa cuando el nombre es inequívoco en AMBOS lados. Un "Bar La
  // Plaza" repetido no se toca: fusionar dos negocios distintos es peor que
  // dejar un duplicado, porque mezcla su historial y no hay vuelta atrás.
  const nombresCx = new Map<string, string[]>();
  for (const l of locations) {
    const k = normalizarNombre(l.locationName);
    if (!k) continue;
    (nombresCx.get(k) ?? nombresCx.set(k, []).get(k)!).push(l.cxDealId);
  }
  const nombresHsm = new Map<string, string[]>();
  for (const c of sinCasarPorId) {
    const k = normalizarNombre(c.name);
    if (!k) continue;
    (nombresHsm.get(k) ?? nombresHsm.set(k, []).get(k)!).push(c.id);
  }

  const huerfanosSinPareja: string[] = [];
  for (const c of sinCasarPorId) {
    const k = normalizarNombre(c.name);
    const candidatosCx = nombresCx.get(k) ?? [];
    const mismosEnHsm = nombresHsm.get(k) ?? [];
    const inequivoco = candidatosCx.length === 1 && mismosEnHsm.length === 1;
    if (!inequivoco || yaAsignados.has(candidatosCx[0])) {
      huerfanosSinPareja.push(c.name);
      continue;
    }
    yaAsignados.add(candidatosCx[0]);
    pares.push({ id: c.id, cxDealId: candidatosCx[0] });
  }

  return {
    pares,
    porRestaurantId: porRestaurantIdCount,
    porNombre: pares.length - porRestaurantIdCount,
    huerfanosSinPareja,
  };
}

async function aplicarAdopcion(pares: { id: string; cxDealId: string }[]): Promise<void> {
  // Un UPDATE por lote y no uno por cliente: son miles de filas y miles de
  // viajes a la base se comerían el tiempo de la función.
  for (let i = 0; i < pares.length; i += LOTE) {
    const lote = pares.slice(i, i + LOTE);
    const valores = sql.join(
      lote.map((p) => sql`(${p.id}::uuid, ${p.cxDealId}::varchar)`),
      sql`, `
    );
    await db.execute(sql`
      UPDATE hsm.clients AS c
         SET cx_deal_id = v.cx_deal_id,
             source     = 'cx_advisor'
        FROM (VALUES ${valores}) AS v(id, cx_deal_id)
       WHERE c.id = v.id
    `);
  }
}

/** cx_deal_id que ya están en la tabla, para saber qué insertaría el sync. */
async function cxDealIdsExistentes(): Promise<Set<string>> {
  const filas = await db
    .select({ cxDealId: clients.cxDealId })
    .from(clients)
    .where(isNotNull(clients.cxDealId));
  return new Set(filas.map((f) => f.cxDealId!).filter(Boolean));
}

async function upsertLote(lote: CxLocation[]): Promise<void> {
  if (lote.length === 0) return;
  const ahora = new Date();

  await db
    .insert(clients)
    .values(
      lote.map((l) => ({
        name: l.locationName,
        externalId: l.restaurantIdBackend,
        city: l.city,
        province: l.provincia,
        businessStage: l.businessStage,
        email: l.email,
        intercomUrl: intercomCompanyUrl(l.intercomCompanyId),
        cxDealId: l.cxDealId,
        source: "cx_advisor" as const,
        syncedAt: ahora,
      }))
    )
    .onConflictDoUpdate({
      target: clients.cxDealId,
      // El índice de cx_deal_id es PARCIAL (WHERE cx_deal_id IS NOT NULL, para
      // no estorbar a los clientes manuales). Postgres solo usa un índice
      // parcial en ON CONFLICT si se repite aquí su mismo predicado; sin esto
      // responde "there is no unique or exclusion constraint matching the
      // ON CONFLICT specification" aunque el índice exista.
      targetWhere: isNotNull(clients.cxDealId),
      // Solo los campos que manda CX Advisor. notes/contact_name/phone/address
      // son del equipo de soporte y se quedan como estén.
      set: {
        name: sql`excluded.name`,
        externalId: sql`excluded.external_id`,
        city: sql`excluded.city`,
        province: sql`excluded.province`,
        businessStage: sql`excluded.business_stage`,
        email: sql`excluded.email`,
        intercomUrl: sql`excluded.intercom_url`,
        source: sql`'cx_advisor'`,
        syncedAt: sql`excluded.synced_at`,
        // `deleted_at` NO se toca a propósito. Si alguien borra un cliente en
        // HSM, es porque no lo quiere ver; resucitarlo en el siguiente sync
        // deshace cada noche una decisión que tomó una persona. Para
        // recuperarlo se pone deleted_at a NULL a mano.
      },
    });
}

async function contarEspejados(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clients)
    .where(isNotNull(clients.cxDealId));
  return row?.n ?? 0;
}

/** CX Advisor guarda el id de compañía; HSM enlaza a la ficha de Intercom. */
function intercomCompanyUrl(companyId: string | null): string | null {
  if (!companyId) return null;
  return `https://app.intercom.com/a/apps/${INTERCOM_APP_ID}/companies/${companyId}`;
}
