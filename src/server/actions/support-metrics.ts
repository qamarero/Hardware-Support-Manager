"use server";

import { getRequiredSession } from "@/lib/auth/get-session";
import { computePeriods, weekRange } from "@/lib/utils/date-periods";
import { getIncidentActivity } from "@/server/queries/incident-metrics";
import {
  getRmaAgingDistribution,
  getRmaStateChangeStats,
  getRmaTimeToSolicitado,
  getRmaClosedCount,
  getRmaOutcomeBreakdown,
} from "@/server/queries/rma-metrics";
import {
  getSlaMetrics,
  getDashboardStats,
  getAgingDistribution,
} from "@/server/queries/dashboard";
import { getSlaThresholds } from "@/server/queries/settings";
import { getRmasAggregates } from "@/server/queries/rmas";
import { getProviderRmaTurnaround } from "@/server/queries/analytics";
import { getMetricReviews, type MetricReviewRow } from "@/server/actions/rma-metric-reviews";
import { fetchUsersForSelect } from "@/server/actions/incidents";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";

export interface SupportMetricsDashboard {
  weekStart: string;
  range: { from: string; to: string; prevFrom: string; prevTo: string };
  values: Record<string, number | null>;
  prevValues: Record<string, number | null>;
  rmaActive: number;
  incidentAging: { bucket: string; count: number }[];
  rmaByStatus: { status: string; label: string; count: number }[];
  rmaStateChangesByDay: { date: string; count: number }[];
  rmaOutcomes: { outcome: string; count: number }[];
  rmaProviderTurnaround: { providerId: string; providerName: string; avgDays: number; rmaCount: number }[];
  reviews: MetricReviewRow[];
  users: { id: string; name: string }[];
}

/**
 * Bundle para la pestaña "Métricas soporte" (incidencias + RMA), semana actual
 * vs anterior + anotaciones editables.
 *
 * IMPORTANTE: se ejecuta en **lotes secuenciales** (no un único Promise.all
 * gigante). Antes disparaba ~30 queries a la vez y saturaba el pool/CPU de
 * Supabase → `statement timeout` → carga infinita. Ahora el pico de
 * concurrencia es ~7 y los snapshots se calculan una sola vez.
 */
export async function fetchSupportMetricsDashboard(weekStart: string): Promise<SupportMetricsDashboard> {
  await getRequiredSession();

  const { from, to } = weekRange(weekStart);
  const { prevFrom, prevTo } = computePeriods(from, to);
  const current = { dateFrom: from, dateTo: to };
  const previous = { dateFrom: prevFrom, dateTo: prevTo };

  // Lote 1 — snapshots (sin rango, una sola vez) + umbrales SLA.
  const [dashStats, incidentAging, rmaAging, slaThresholds] = await Promise.all([
    getDashboardStats(),
    getAgingDistribution(),
    getRmaAgingDistribution(),
    getSlaThresholds(),
  ]);
  const incGt7 = incidentAging.find((b) => b.bucket === "7+ días")?.count ?? 0;

  // Lote 2 — periodo actual.
  const [slaCur, incActCur, rmaScCur, rmaTtCur, rmaClosedCur] = await Promise.all([
    getSlaMetrics(current, slaThresholds),
    getIncidentActivity(current),
    getRmaStateChangeStats(current),
    getRmaTimeToSolicitado(current),
    getRmaClosedCount(current),
  ]);

  // Lote 3 — periodo anterior.
  const [slaPrev, incActPrev, rmaScPrev, rmaTtPrev, rmaClosedPrev] = await Promise.all([
    getSlaMetrics(previous, slaThresholds),
    getIncidentActivity(previous),
    getRmaStateChangeStats(previous),
    getRmaTimeToSolicitado(previous),
    getRmaClosedCount(previous),
  ]);

  // Lote 4 — charts + anotaciones.
  const [aggregates, rmaOutcomes, rmaProviderTurnaround, reviews, users] = await Promise.all([
    getRmasAggregates({ dateRangeFrom: from, dateRangeTo: to }),
    getRmaOutcomeBreakdown(current),
    getProviderRmaTurnaround(current),
    getMetricReviews(weekStart),
    fetchUsersForSelect(),
  ]);

  const values: Record<string, number | null> = {
    inc_open: dashStats.openIncidents,
    inc_aging_gt7: incGt7,
    inc_sla_compliance: slaCur.slaCompliancePercent,
    inc_avg_resolution_h: slaCur.avgResolutionHours,
    inc_overdue: slaCur.overdueCount,
    inc_resolved: incActCur.resolved,
    inc_state_changes: incActCur.stateChanges,
    rma_time_to_solicitado: rmaTtCur.avgHours,
    rma_solicitado_within_target: rmaTtCur.withinTargetPct,
    rma_aging_gt7: rmaAging.gt7d,
    rma_state_changes: rmaScCur.total,
    rma_solicitudes: rmaScCur.solicitudes,
    rma_cerrados: rmaClosedCur,
  };

  const prevValues: Record<string, number | null> = {
    // Snapshots: mismo valor (no dependen del rango) → delta neutro.
    inc_open: dashStats.openIncidents,
    inc_aging_gt7: incGt7,
    inc_overdue: slaPrev.overdueCount,
    rma_aging_gt7: rmaAging.gt7d,
    // De actividad (comparables con la semana anterior):
    inc_sla_compliance: slaPrev.slaCompliancePercent,
    inc_avg_resolution_h: slaPrev.avgResolutionHours,
    inc_resolved: incActPrev.resolved,
    inc_state_changes: incActPrev.stateChanges,
    rma_time_to_solicitado: rmaTtPrev.avgHours,
    rma_solicitado_within_target: rmaTtPrev.withinTargetPct,
    rma_state_changes: rmaScPrev.total,
    rma_solicitudes: rmaScPrev.solicitudes,
    rma_cerrados: rmaClosedPrev,
  };

  return {
    weekStart,
    range: { from, to, prevFrom, prevTo },
    values,
    prevValues,
    rmaActive: rmaAging.openTotal,
    incidentAging,
    rmaByStatus: aggregates.byStatus.map((r) => ({
      status: r.status,
      label: RMA_STATUS_LABELS[r.status as RmaStatus] ?? r.status,
      count: r.count,
    })),
    rmaStateChangesByDay: rmaScCur.byDay,
    rmaOutcomes,
    rmaProviderTurnaround,
    reviews,
    users: users.map((u) => ({ id: u.id, name: u.name })),
  };
}
