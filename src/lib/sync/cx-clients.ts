import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { and, isNull, isNotNull, sql } from "drizzle-orm";
import { fetchCxLocations, type CxLocation } from "@/lib/db/cx-advisor";
import { INTERCOM_APP_ID } from "@/lib/utils/intercom-url";

export interface SyncClientsResult {
  simulacion: boolean;
  leidos: number;
  adoptados: number;
  insertados: number;
  actualizados: number;
  /** Clientes de HSM con external_id que NO existe en CX Advisor. Cada uno
   *  acabará conviviendo con la ficha nueva: son los duplicados a revisar. */
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

  const plan = await planificarAdopcion(locations);

  if (dryRun) {
    // Cuántas locations todavía no tienen ficha: las que no adopta nadie y
    // cuyo cx_deal_id no está ya en la tabla.
    const yaEspejados = await cxDealIdsExistentes();
    const cubiertos = new Set([...yaEspejados, ...plan.pares.map((p) => p.cxDealId)]);
    const insertaria = locations.filter((l) => !cubiertos.has(l.cxDealId)).length;
    return {
      simulacion: true,
      leidos: locations.length,
      adoptados: plan.pares.length,
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
  /** Nombres de clientes de HSM cuyo external_id no existe en CX Advisor. */
  huerfanosSinPareja: string[];
}

async function planificarAdopcion(locations: CxLocation[]): Promise<PlanAdopcion> {
  const porRestaurantId = new Map<string, string>();
  for (const l of locations) {
    if (l.restaurantIdBackend) {
      // trim() no es cosmético: en CX Advisor hay restaurant_id_backend con un
      // tabulador pegado al final (p. ej. el de "CX - Canela en rama"). Sin
      // limpiarlo, esos clientes no casan y se duplican.
      porRestaurantId.set(l.restaurantIdBackend.trim().toLowerCase(), l.cxDealId);
    }
  }

  const huerfanos = await db
    .select({ id: clients.id, name: clients.name, externalId: clients.externalId })
    .from(clients)
    .where(and(isNull(clients.cxDealId), isNotNull(clients.externalId)));

  const pares: { id: string; cxDealId: string }[] = [];
  const huerfanosSinPareja: string[] = [];
  // Un mismo restaurant_id puede estar repetido en hsm.clients (fichas
  // duplicadas de la importación antigua). Solo se adopta la primera: el
  // índice único de cx_deal_id rechazaría la segunda y tumbaría el lote.
  const yaAsignados = new Set<string>();

  for (const c of huerfanos) {
    const cxDealId = porRestaurantId.get((c.externalId ?? "").trim().toLowerCase());
    if (!cxDealId) {
      // Su restaurant_id ya no existe en CX Advisor: o cambió, o el
      // restaurante se dio de alta otra vez con otro id. Su ficha se queda y
      // convivirá con la nueva que traiga el sync.
      huerfanosSinPareja.push(c.name);
      continue;
    }
    if (yaAsignados.has(cxDealId)) continue;
    yaAsignados.add(cxDealId);
    pares.push({ id: c.id, cxDealId });
  }

  return { pares, huerfanosSinPareja };
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
