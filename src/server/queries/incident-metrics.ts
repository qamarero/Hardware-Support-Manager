import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { DateRangeParams } from "@/lib/utils/date-conditions";
import { getSlaMetrics, getDashboardStats, getAgingDistribution } from "@/server/queries/dashboard";

/**
 * KPIs de INCIDENCIAS para el reporte de soporte (pestaña + endpoint). Reutiliza
 * las queries del dashboard (SLA, snapshot, aging) y añade actividad de la
 * semana (cambios de estado + resueltas) desde `event_logs`/`incidents`.
 */

async function getIncidentActivity(range?: DateRangeParams): Promise<{ stateChanges: number; resolved: number }> {
  const from = range?.dateFrom;
  const to = range?.dateTo;
  const logFrom = from ? sql`AND created_at >= ${from + "T00:00:00"}` : sql``;
  const logTo = to ? sql`AND created_at <= ${to + "T23:59:59"}` : sql``;
  const resFrom = from ? sql`AND resolved_at >= ${from + "T00:00:00"}` : sql``;
  const resTo = to ? sql`AND resolved_at <= ${to + "T23:59:59"}` : sql``;
  try {
    const res = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM hsm.event_logs
          WHERE entity_type = 'incident' AND action = 'transition' ${logFrom} ${logTo}) AS state_changes,
        (SELECT count(*)::int FROM hsm.incidents
          WHERE status IN ('resuelto','cerrado') AND resolved_at IS NOT NULL
            AND category != 'consulta_rapida' ${resFrom} ${resTo}) AS resolved
    `);
    const row = res[0] as { state_changes: number; resolved: number } | undefined;
    return {
      stateChanges: Number(row?.state_changes) || 0,
      resolved: Number(row?.resolved) || 0,
    };
  } catch {
    return { stateChanges: 0, resolved: 0 };
  }
}

export async function getIncidentMetricValues(
  range?: DateRangeParams,
): Promise<Record<string, number | null>> {
  const [sla, stats, aging, activity] = await Promise.all([
    getSlaMetrics(range),
    getDashboardStats(),
    getAgingDistribution(),
    getIncidentActivity(range),
  ]);
  const gt7 = aging.find((b) => b.bucket === "7+ días")?.count ?? 0;
  return {
    inc_open: stats.openIncidents,
    inc_aging_gt7: gt7,
    inc_sla_compliance: sla.slaCompliancePercent,
    inc_avg_resolution_h: sla.avgResolutionHours,
    inc_overdue: sla.overdueCount,
    inc_resolved: activity.resolved,
    inc_state_changes: activity.stateChanges,
  };
}
