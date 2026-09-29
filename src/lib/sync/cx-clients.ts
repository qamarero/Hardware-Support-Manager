import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { fetchCxLocations, type CxLocation } from "@/lib/db/cx-advisor";
import { INTERCOM_APP_ID } from "@/lib/utils/intercom-url";

export interface SyncClientsResult {
  leidos: number;
  adoptados: number;
  insertados: number;
  actualizados: number;
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
export async function syncClientsFromCxAdvisor(): Promise<SyncClientsResult> {
  const t0 = Date.now();
  const locations = await fetchCxLocations();

  const adoptados = await adoptarPorRestaurantId(locations);

  const antes = await contarEspejados();
  for (let i = 0; i < locations.length; i += LOTE) {
    await upsertLote(locations.slice(i, i + LOTE));
  }
  const despues = await contarEspejados();

  const insertados = Math.max(0, despues - antes);
  return {
    leidos: locations.length,
    adoptados,
    insertados,
    actualizados: locations.length - insertados,
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
async function adoptarPorRestaurantId(locations: CxLocation[]): Promise<number> {
  const porRestaurantId = new Map<string, string>();
  for (const l of locations) {
    if (l.restaurantIdBackend) {
      porRestaurantId.set(l.restaurantIdBackend.toLowerCase(), l.cxDealId);
    }
  }
  if (porRestaurantId.size === 0) return 0;

  const huerfanos = await db
    .select({ id: clients.id, externalId: clients.externalId })
    .from(clients)
    .where(and(isNull(clients.cxDealId), isNotNull(clients.externalId)));

  let adoptados = 0;
  for (const c of huerfanos) {
    const cxDealId = porRestaurantId.get((c.externalId ?? "").trim().toLowerCase());
    if (!cxDealId) continue;
    await db
      .update(clients)
      .set({ cxDealId, source: "cx_advisor" })
      .where(eq(clients.id, c.id));
    adoptados++;
  }
  return adoptados;
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
