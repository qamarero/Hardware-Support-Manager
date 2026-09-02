import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSlaThresholds } from "@/server/queries/settings";
import type { SlaThresholds } from "@/lib/constants/sla";
import { buildSlaPriorityConditionRaw } from "@/lib/utils/sla-sql";
import {
  CLOSED_INCIDENT_STATUSES,
  CLOSED_RMA_STATUSES,
  PAUSED_INCIDENT_STATES,
  PAUSED_RMA_STATES,
} from "@/lib/constants/statuses";

/**
 * Métricas de STOCK reconstruidas a una fecha de corte.
 *
 * Las queries de `dashboard.ts` / `rma-metrics.ts` calculan el stock con
 * `now()` y descartan el rango recibido (`void _range`): son correctas para el
 * dashboard en vivo, pero al reutilizarlas en el informe semanal devolvían
 * siempre el estado de HOY, así que exportar cinco semanas distintas el mismo
 * día daba cinco veces el mismo número. Aquí el estado se reconstruye al
 * cierre del periodo a partir de `hsm.event_logs`.
 *
 * Cómo se reconstruye el estado de una entidad en un instante `cutoff`:
 *
 * 1. Última transición con `created_at <= cutoff` → su `to_state` es el estado
 *    que tenía en ese momento, y su `created_at` es desde cuándo lo tenía.
 * 2. Si no hubo ninguna transición previa al corte pero sí posteriores, el
 *    estado era el `from_state` de la primera posterior.
 * 3. Si nunca hubo transiciones, el estado actual es el que tuvo siempre.
 *
 * `state_changed_at` y `sla_paused_ms` de las tablas NO sirven para esto: son
 * campos mutables que solo reflejan la situación de hoy. El tiempo en pausa
 * hasta el corte se recalcula sumando los tramos en estados pausados que ya
 * habían terminado en ese momento, que es la misma regla que aplican las
 * actions al acumular `sla_paused_ms` (se suma al SALIR de la pausa, sin
 * contar el tramo en curso).
 */

export interface StockSnapshot {
  /** Fecha de corte efectiva usada (ISO, sin zona: hora del servidor). */
  cutoff: string;
  openTotal: number;
  buckets: { bucket: string; count: number }[];
  gt7d: number;
  /** Solo incidencias: abiertas al corte que ya superaban su umbral SLA. */
  overdue: number;
}

const AGING_BUCKETS = ["< 1 día", "1-3 días", "3-7 días", "7+ días"] as const;

const EMPTY: StockSnapshot = {
  cutoff: "",
  openTotal: 0,
  buckets: AGING_BUCKETS.map((b) => ({ bucket: b, count: 0 })),
  gt7d: 0,
  overdue: 0,
};

/** Fin de día (23:59:59) del `YYYY-MM-DD` dado, en la convención sin zona que
 *  ya usan el resto de queries (`rawDateFragments`). */
export function endOfDayCutoff(isoDate: string): string {
  return `${isoDate}T23:59:59`;
}

/** Lista de estados como literal SQL `('a','b','c')`. */
function statusList(values: readonly string[]) {
  return sql`(${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;
}

function rowToSnapshot(
  cutoff: string,
  row: Record<string, string | number | null> | undefined,
): StockSnapshot {
  if (!row) return { ...EMPTY, cutoff };
  const n = (k: string) => Number(row[k]) || 0;
  const buckets = [
    { bucket: AGING_BUCKETS[0], count: n("lt1") },
    { bucket: AGING_BUCKETS[1], count: n("d13") },
    { bucket: AGING_BUCKETS[2], count: n("d37") },
    { bucket: AGING_BUCKETS[3], count: n("gt7") },
  ];
  return {
    cutoff,
    openTotal: n("open_total"),
    buckets,
    gt7d: n("gt7"),
    overdue: n("overdue"),
  };
}

/**
 * Incidencias abiertas, reparto por antigüedad en el estado y fuera de SLA,
 * todo al cierre de `cutoffIso` (YYYY-MM-DD).
 */
export async function getIncidentStockAt(
  cutoffIso: string,
  preloadedSla?: SlaThresholds,
): Promise<StockSnapshot> {
  const cutoff = endOfDayCutoff(cutoffIso);
  try {
    const sla = preloadedSla ?? (await getSlaThresholds());
    // El umbral se evalúa sobre `elapsed_h`, calculado al corte (no con now()).
    const overdueCondition = buildSlaPriorityConditionRaw(
      sla,
      sql<number>`elapsed_h`,
      "exceeded",
    );

    const result = await db.execute(sql`
      WITH tx AS (
        SELECT
          entity_id,
          from_state,
          to_state,
          created_at,
          LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) AS next_at
        FROM hsm.event_logs
        WHERE entity_type = 'incident' AND action = 'transition'
      ),
      last_before AS (
        SELECT DISTINCT ON (entity_id) entity_id, to_state AS state, created_at AS since
        FROM tx
        WHERE created_at <= ${cutoff}
        ORDER BY entity_id, created_at DESC
      ),
      first_after AS (
        SELECT DISTINCT ON (entity_id) entity_id, from_state AS state
        FROM tx
        WHERE created_at > ${cutoff}
        ORDER BY entity_id, created_at ASC
      ),
      paused AS (
        SELECT entity_id,
               SUM(extract(epoch from (next_at - created_at)) * 1000)::bigint AS paused_ms
        FROM tx
        WHERE to_state IN ${statusList(PAUSED_INCIDENT_STATES)}
          AND next_at IS NOT NULL
          AND next_at <= ${cutoff}
        GROUP BY entity_id
      ),
      snap AS (
        SELECT
          i.priority::text AS priority,
          COALESCE(lb.state, fa.state, i.status::text) AS status_at,
          COALESCE(lb.since, i.created_at) AS state_since,
          i.created_at,
          COALESCE(p.paused_ms, 0) AS paused_ms
        FROM hsm.incidents i
        LEFT JOIN last_before lb ON lb.entity_id = i.id
        LEFT JOIN first_after fa ON fa.entity_id = i.id
        LEFT JOIN paused p ON p.entity_id = i.id
        WHERE i.created_at <= ${cutoff}
      ),
      open_snap AS (
        SELECT
          priority,
          (extract(epoch from (${cutoff}::timestamptz - created_at)) * 1000 - paused_ms) / 3600000.0 AS elapsed_h,
          extract(epoch from (${cutoff}::timestamptz - state_since)) / 86400.0 AS days_in_state
        FROM snap
        WHERE status_at NOT IN ${statusList(CLOSED_INCIDENT_STATUSES)}
      )
      SELECT
        count(*)::int AS open_total,
        count(*) FILTER (WHERE days_in_state < 1)::int AS lt1,
        count(*) FILTER (WHERE days_in_state >= 1 AND days_in_state < 3)::int AS d13,
        count(*) FILTER (WHERE days_in_state >= 3 AND days_in_state < 7)::int AS d37,
        count(*) FILTER (WHERE days_in_state >= 7)::int AS gt7,
        count(*) FILTER (WHERE ${overdueCondition})::int AS overdue
      FROM open_snap
    `);

    return rowToSnapshot(cutoff, result[0] as Record<string, string> | undefined);
  } catch (err) {
    // Devolver ceros en silencio haría pasar un fallo de SQL por "semana sin
    // actividad" en un informe archivado. Que quede en los logs.
    console.error("[historical-metrics] getIncidentStockAt", cutoff, err);
    return { ...EMPTY, cutoff };
  }
}

/**
 * RMA activos y su reparto por antigüedad al cierre de `cutoffIso`.
 *
 * Replica la fórmula de `getRmaAgingDistribution`: días activos = tiempo desde
 * la creación menos las pausas cerradas, y si al corte estaba en un estado
 * pausado también se descuenta el tramo en curso (el reloj está parado).
 */
export async function getRmaStockAt(cutoffIso: string): Promise<StockSnapshot> {
  const cutoff = endOfDayCutoff(cutoffIso);
  try {
    const result = await db.execute(sql`
      WITH tx AS (
        SELECT
          entity_id,
          from_state,
          to_state,
          created_at,
          LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) AS next_at
        FROM hsm.event_logs
        WHERE entity_type = 'rma' AND action = 'transition'
      ),
      last_before AS (
        SELECT DISTINCT ON (entity_id) entity_id, to_state AS state, created_at AS since
        FROM tx
        WHERE created_at <= ${cutoff}
        ORDER BY entity_id, created_at DESC
      ),
      first_after AS (
        SELECT DISTINCT ON (entity_id) entity_id, from_state AS state
        FROM tx
        WHERE created_at > ${cutoff}
        ORDER BY entity_id, created_at ASC
      ),
      paused AS (
        SELECT entity_id,
               SUM(extract(epoch from (next_at - created_at)) * 1000)::bigint AS paused_ms
        FROM tx
        WHERE to_state IN ${statusList(PAUSED_RMA_STATES)}
          AND next_at IS NOT NULL
          AND next_at <= ${cutoff}
        GROUP BY entity_id
      ),
      snap AS (
        SELECT
          COALESCE(lb.state, fa.state, r.status::text) AS status_at,
          COALESCE(lb.since, r.created_at) AS state_since,
          r.created_at,
          COALESCE(p.paused_ms, 0) AS paused_ms
        FROM hsm.rmas r
        LEFT JOIN last_before lb ON lb.entity_id = r.id
        LEFT JOIN first_after fa ON fa.entity_id = r.id
        LEFT JOIN paused p ON p.entity_id = r.id
        WHERE r.created_at <= ${cutoff}
      ),
      open_snap AS (
        SELECT (
          extract(epoch from (${cutoff}::timestamptz - created_at)) * 1000
          - paused_ms
          - CASE WHEN status_at IN ${statusList(PAUSED_RMA_STATES)}
                 THEN extract(epoch from (${cutoff}::timestamptz - state_since)) * 1000
                 ELSE 0 END
        ) / 86400000.0 AS active_days
        FROM snap
        WHERE status_at NOT IN ${statusList(CLOSED_RMA_STATUSES)}
      )
      SELECT
        count(*)::int AS open_total,
        count(*) FILTER (WHERE active_days < 1)::int AS lt1,
        count(*) FILTER (WHERE active_days >= 1 AND active_days < 3)::int AS d13,
        count(*) FILTER (WHERE active_days >= 3 AND active_days < 7)::int AS d37,
        count(*) FILTER (WHERE active_days >= 7)::int AS gt7,
        0::int AS overdue
      FROM open_snap
    `);

    return rowToSnapshot(cutoff, result[0] as Record<string, string> | undefined);
  } catch (err) {
    console.error("[historical-metrics] getRmaStockAt", cutoff, err);
    return { ...EMPTY, cutoff };
  }
}
