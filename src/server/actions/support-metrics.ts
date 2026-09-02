"use server";

import { getRequiredSession } from "@/lib/auth/get-session";
import { computePeriods, weekRange } from "@/lib/utils/date-periods";
import {
  getIncidentActivity,
  getWeeklyIncidentActivity,
  type WeeklyIncidentActivity,
} from "@/server/queries/incident-metrics";
import {
  getRmaStateChangeStats,
  getRmaTimeToSolicitado,
  getRmaClosedCount,
  getRmaOutcomeBreakdown,
} from "@/server/queries/rma-metrics";
import { getSlaMetrics } from "@/server/queries/dashboard";
import { getIncidentStockAt, getRmaStockAt } from "@/server/queries/historical-metrics";
import { getSlaThresholds } from "@/server/queries/settings";
import { getRmasAggregates } from "@/server/queries/rmas";
import { getProviderRmaTurnaround } from "@/server/queries/analytics";
import { getMetricReviews, type MetricReviewRow } from "@/server/actions/rma-metric-reviews";
import { fetchUsersForSelect } from "@/server/actions/incidents";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";

export interface SupportMetricsDashboard {
  weekStart: string;
  range: { from: string; to: string; prevFrom: string; prevTo: string };
  /**
   * Fechas de corte con las que se han reconstruido las métricas de stock
   * (abiertas, antigüedad, fuera de SLA) y momento de generación. Van al CSV
   * para que un informe archivado diga a qué instante corresponde.
   */
  meta: { stockCutoff: string; prevStockCutoff: string; generatedAt: string };
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
/**
 * Informe de actividad semanal de incidencias (por incidencia) para la sección
 * de /metricas. Devuelve `null` si falla, para que la UI muestre un estado de
 * error con reintento en vez de un spinner infinito.
 */
export async function fetchWeeklyIncidentActivity(
  weekStart: string,
): Promise<WeeklyIncidentActivity | null> {
  try {
    await getRequiredSession();
    const { from, to } = weekRange(weekStart);
    return await getWeeklyIncidentActivity(from, to);
  } catch {
    return null;
  }
}

export async function fetchSupportMetricsDashboard(weekStart: string): Promise<SupportMetricsDashboard> {
  await getRequiredSession();

  const { from, to } = weekRange(weekStart);
  const { prevFrom, prevTo } = computePeriods(from, to);
  const current = { dateFrom: from, dateTo: to };
  const previous = { dateFrom: prevFrom, dateTo: prevTo };

  // Lote 1 — umbrales SLA (los necesita el cálculo de "fuera de SLA al corte").
  const slaThresholds = await getSlaThresholds();

  // Lote 2 — stock reconstruido al CIERRE de cada periodo (domingo 23:59:59),
  // no en el momento de abrir la pantalla. Así el informe de una semana pasada
  // devuelve el estado que había esa semana y la comparativa con la anterior
  // es un delta real. Ver `historical-metrics.ts`.
  const [incStock, rmaStock, incStockPrev, rmaStockPrev] = await Promise.all([
    getIncidentStockAt(to, slaThresholds),
    getRmaStockAt(to),
    getIncidentStockAt(prevTo, slaThresholds),
    getRmaStockAt(prevTo),
  ]);

  // Lote 3 — periodo actual.
  const [slaCur, incActCur, rmaScCur, rmaTtCur, rmaClosedCur] = await Promise.all([
    getSlaMetrics(current, slaThresholds),
    getIncidentActivity(current),
    getRmaStateChangeStats(current),
    getRmaTimeToSolicitado(current),
    getRmaClosedCount(current),
  ]);

  // Lote 4 — periodo anterior.
  const [slaPrev, incActPrev, rmaScPrev, rmaTtPrev, rmaClosedPrev] = await Promise.all([
    getSlaMetrics(previous, slaThresholds),
    getIncidentActivity(previous),
    getRmaStateChangeStats(previous),
    getRmaTimeToSolicitado(previous),
    getRmaClosedCount(previous),
  ]);

  // Lote 5 — charts + anotaciones.
  const [aggregates, rmaOutcomes, rmaProviderTurnaround, reviews, users] = await Promise.all([
    getRmasAggregates({ dateRangeFrom: from, dateRangeTo: to }),
    getRmaOutcomeBreakdown(current),
    getProviderRmaTurnaround(current),
    getMetricReviews(weekStart),
    fetchUsersForSelect(),
  ]);

  const values: Record<string, number | null> = {
    inc_open: incStock.openTotal,
    inc_open_inhouse: incStock.inHouse,
    inc_open_waiting: incStock.waiting,
    inc_aging_gt7: incStock.gt7d,
    inc_sla_compliance: slaCur.slaCompliancePercent,
    inc_avg_resolution_h: slaCur.avgResolutionHours,
    inc_avg_wait_h: slaCur.avgWaitHours,
    inc_overdue: incStock.overdue,
    inc_resolved: incActCur.resolved,
    inc_state_changes: incActCur.stateChanges,
    rma_time_to_solicitado: rmaTtCur.avgHours,
    rma_solicitado_within_target: rmaTtCur.withinTargetPct,
    rma_aging_gt7: rmaStock.gt7d,
    rma_state_changes: rmaScCur.total,
    rma_solicitudes: rmaScCur.solicitudes,
    rma_cerrados: rmaClosedCur,
  };

  const prevValues: Record<string, number | null> = {
    // Stock al cierre de la semana ANTERIOR (antes se copiaba el valor actual,
    // así que el delta siempre salía 0).
    inc_open: incStockPrev.openTotal,
    inc_open_inhouse: incStockPrev.inHouse,
    inc_open_waiting: incStockPrev.waiting,
    inc_aging_gt7: incStockPrev.gt7d,
    inc_overdue: incStockPrev.overdue,
    rma_aging_gt7: rmaStockPrev.gt7d,
    // De actividad (comparables con la semana anterior):
    inc_sla_compliance: slaPrev.slaCompliancePercent,
    inc_avg_resolution_h: slaPrev.avgResolutionHours,
    inc_avg_wait_h: slaPrev.avgWaitHours,
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
    meta: {
      stockCutoff: incStock.cutoff,
      prevStockCutoff: incStockPrev.cutoff,
      generatedAt: new Date().toISOString(),
    },
    values,
    prevValues,
    rmaActive: rmaStock.openTotal,
    incidentAging: incStock.buckets,
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
