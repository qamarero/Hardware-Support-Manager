import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { DateRangeParams } from "@/lib/utils/date-conditions";
import { RMA_SOLICITADO_TARGET_HOURS } from "@/lib/constants/rma-metrics";

/**
 * Queries de KPIs de RMA, reutilizadas por la pestaña "Métricas RMA" y por el
 * endpoint externo `/api/external/metrics`. Los tiempos entre estados se
 * derivan de `event_logs` (los RMA solo guardan el ÚLTIMO `state_changed_at`).
 *
 * Convención de estados (13, ver `src/lib/constants/statuses.ts`):
 *   pausados: solicitado, enviado_proveedor, en_proveedor, enviado_cliente, esperando_cliente
 *   cerrados: entregado_cliente, rechazado, cerrado, cancelado
 */

function fromCond(col: string, from?: string) {
  return from ? sql`AND ${sql.raw(col)} >= ${from + "T00:00:00"}` : sql``;
}
function toCond(col: string, to?: string) {
  return to ? sql`AND ${sql.raw(col)} <= ${to + "T23:59:59"}` : sql``;
}

// ─── Aging (snapshot, edad activa descontando pausas) ────────────────────────

export interface RmaAgingDistribution {
  ltDay1: number;
  day1to3: number;
  day3to7: number;
  gt7d: number;
  openTotal: number;
  buckets: { bucket: string; count: number }[];
}

export async function getRmaAgingDistribution(): Promise<RmaAgingDistribution> {
  try {
    const res = await db.execute(sql`
      WITH open_rmas AS (
        SELECT (
          extract(epoch from (now() - created_at)) * 1000
          - COALESCE(NULLIF(sla_paused_ms, '')::bigint, 0)
          - CASE WHEN status IN ('solicitado','enviado_proveedor','en_proveedor','enviado_cliente','esperando_cliente')
                 THEN extract(epoch from (now() - state_changed_at)) * 1000 ELSE 0 END
        ) / 86400000.0 AS active_days
        FROM hsm.rmas
        WHERE status NOT IN ('entregado_cliente','rechazado','cerrado','cancelado')
      )
      SELECT
        count(*) FILTER (WHERE active_days < 1)::int AS lt1,
        count(*) FILTER (WHERE active_days >= 1 AND active_days < 3)::int AS d13,
        count(*) FILTER (WHERE active_days >= 3 AND active_days < 7)::int AS d37,
        count(*) FILTER (WHERE active_days >= 7)::int AS gt7,
        count(*)::int AS total
      FROM open_rmas
    `);
    const row = res[0] as
      | { lt1: number; d13: number; d37: number; gt7: number; total: number }
      | undefined;
    const lt1 = Number(row?.lt1) || 0;
    const d13 = Number(row?.d13) || 0;
    const d37 = Number(row?.d37) || 0;
    const gt7 = Number(row?.gt7) || 0;
    return {
      ltDay1: lt1,
      day1to3: d13,
      day3to7: d37,
      gt7d: gt7,
      openTotal: Number(row?.total) || 0,
      buckets: [
        { bucket: "< 1 día", count: lt1 },
        { bucket: "1-3 días", count: d13 },
        { bucket: "3-7 días", count: d37 },
        { bucket: "7+ días", count: gt7 },
      ],
    };
  } catch {
    return { ltDay1: 0, day1to3: 0, day3to7: 0, gt7d: 0, openTotal: 0, buckets: [] };
  }
}

// ─── Cambios de estado (event_logs) ──────────────────────────────────────────

export interface RmaStateChangeStats {
  total: number;
  solicitudes: number;
  byToState: { status: string; count: number }[];
  byDay: { date: string; count: number }[];
}

export async function getRmaStateChangeStats(
  range?: DateRangeParams,
): Promise<RmaStateChangeStats> {
  const f = fromCond("created_at", range?.dateFrom);
  const t = toCond("created_at", range?.dateTo);
  try {
    const [totals, byState, byDay] = await Promise.all([
      db.execute(sql`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE to_state = 'solicitado')::int AS solicitudes
        FROM hsm.event_logs
        WHERE entity_type = 'rma' AND action = 'transition' ${f} ${t}
      `),
      db.execute(sql`
        SELECT to_state AS status, count(*)::int AS count
        FROM hsm.event_logs
        WHERE entity_type = 'rma' AND action = 'transition' AND to_state IS NOT NULL ${f} ${t}
        GROUP BY to_state ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date, count(*)::int AS count
        FROM hsm.event_logs
        WHERE entity_type = 'rma' AND action = 'transition' ${f} ${t}
        GROUP BY 1 ORDER BY 1
      `),
    ]);
    const totalRow = totals[0] as { total: number; solicitudes: number } | undefined;
    return {
      total: Number(totalRow?.total) || 0,
      solicitudes: Number(totalRow?.solicitudes) || 0,
      byToState: (byState as unknown as { status: string; count: number }[]).map((r) => ({
        status: r.status,
        count: Number(r.count) || 0,
      })),
      byDay: (byDay as unknown as { date: string; count: number }[]).map((r) => ({
        date: r.date,
        count: Number(r.count) || 0,
      })),
    };
  } catch {
    return { total: 0, solicitudes: 0, byToState: [], byDay: [] };
  }
}

// ─── Tiempo hasta tramitar (creación → primer «solicitado») ──────────────────

export interface RmaTimeToSolicitado {
  count: number;
  avgHours: number | null;
  withinTargetPct: number | null;
}

export async function getRmaTimeToSolicitado(
  range?: DateRangeParams,
  targetHours: number = RMA_SOLICITADO_TARGET_HOURS,
): Promise<RmaTimeToSolicitado> {
  const f = fromCond("fs.solicitado_at", range?.dateFrom);
  const t = toCond("fs.solicitado_at", range?.dateTo);
  try {
    const res = await db.execute(sql`
      WITH first_sol AS (
        SELECT entity_id AS rma_id, min(created_at) AS solicitado_at
        FROM hsm.event_logs
        WHERE entity_type = 'rma' AND action = 'transition' AND to_state = 'solicitado'
        GROUP BY entity_id
      )
      SELECT
        count(*)::int AS cnt,
        avg(extract(epoch from (fs.solicitado_at - r.created_at)) / 3600.0) AS avg_h,
        count(*) FILTER (
          WHERE extract(epoch from (fs.solicitado_at - r.created_at)) / 3600.0 <= ${targetHours}
        )::int AS within
      FROM first_sol fs
      JOIN hsm.rmas r ON r.id = fs.rma_id
      WHERE true ${f} ${t}
    `);
    const row = res[0] as { cnt: number; avg_h: string | number | null; within: number } | undefined;
    const count = Number(row?.cnt) || 0;
    const avgHours = row?.avg_h != null ? Math.round(Number(row.avg_h) * 10) / 10 : null;
    const within = Number(row?.within) || 0;
    return {
      count,
      avgHours,
      withinTargetPct: count > 0 ? Math.round((within / count) * 1000) / 10 : null,
    };
  } catch {
    return { count: 0, avgHours: null, withinTargetPct: null };
  }
}

// ─── Resultados al cierre ────────────────────────────────────────────────────

export async function getRmaOutcomeBreakdown(
  range?: DateRangeParams,
): Promise<{ outcome: string; count: number }[]> {
  const f = fromCond("state_changed_at", range?.dateFrom);
  const t = toCond("state_changed_at", range?.dateTo);
  try {
    const res = await db.execute(sql`
      SELECT outcome, count(*)::int AS count
      FROM hsm.rmas
      WHERE status IN ('entregado_cliente','rechazado','cerrado','cancelado')
        AND outcome IS NOT NULL ${f} ${t}
      GROUP BY outcome ORDER BY count DESC
    `);
    return (res as unknown as { outcome: string; count: number }[]).map((r) => ({
      outcome: r.outcome,
      count: Number(r.count) || 0,
    }));
  } catch {
    return [];
  }
}

export async function getRmaClosedCount(range?: DateRangeParams): Promise<number> {
  const f = fromCond("state_changed_at", range?.dateFrom);
  const t = toCond("state_changed_at", range?.dateTo);
  try {
    const res = await db.execute(sql`
      SELECT count(*)::int AS c
      FROM hsm.rmas
      WHERE status IN ('entregado_cliente','rechazado','cerrado','cancelado') ${f} ${t}
    `);
    return Number((res[0] as { c: number } | undefined)?.c) || 0;
  } catch {
    return 0;
  }
}

// ─── Valores del catálogo (por rango) ────────────────────────────────────────

/**
 * Calcula los valores de las métricas del catálogo (`RMA_METRIC_CATALOG`) para
 * un rango. `rma_aging_gt7` es SNAPSHOT (estado actual de la cola), el resto son
 * de actividad en el rango. Devuelve un mapa metric_key → valor (o null).
 */
export async function getRmaMetricValues(
  range?: DateRangeParams,
): Promise<Record<string, number | null>> {
  const [stateChanges, timeToSol, aging, closed] = await Promise.all([
    getRmaStateChangeStats(range),
    getRmaTimeToSolicitado(range),
    getRmaAgingDistribution(),
    getRmaClosedCount(range),
  ]);
  return {
    rma_time_to_solicitado: timeToSol.avgHours,
    rma_solicitado_within_target: timeToSol.withinTargetPct,
    rma_aging_gt7: aging.gt7d,
    rma_state_changes: stateChanges.total,
    rma_solicitudes: stateChanges.solicitudes,
    rma_cerrados: closed,
  };
}
