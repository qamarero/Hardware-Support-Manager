"use server";

import { getRequiredSession } from "@/lib/auth/get-session";
import { computePeriods, weekRange } from "@/lib/utils/date-periods";
import { getIncidentMetricValues } from "@/server/queries/incident-metrics";
import {
  getRmaMetricValues,
  getRmaAgingDistribution,
  getRmaStateChangeStats,
  getRmaOutcomeBreakdown,
} from "@/server/queries/rma-metrics";
import { getAgingDistribution } from "@/server/queries/dashboard";
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
 * Bundle único para la pestaña "Métricas soporte": KPIs de INCIDENCIAS + RMA de
 * la semana y la anterior, snapshots (aging), actividad y anotaciones editables.
 */
export async function fetchSupportMetricsDashboard(weekStart: string): Promise<SupportMetricsDashboard> {
  await getRequiredSession();

  const { from, to } = weekRange(weekStart);
  const { prevFrom, prevTo } = computePeriods(from, to);
  const current = { dateFrom: from, dateTo: to };
  const previous = { dateFrom: prevFrom, dateTo: prevTo };

  const [
    incValues,
    incPrev,
    rmaValues,
    rmaPrev,
    rmaAging,
    incidentAging,
    aggregates,
    rmaStateChanges,
    rmaOutcomes,
    rmaProviderTurnaround,
    reviews,
    users,
  ] = await Promise.all([
    getIncidentMetricValues(current),
    getIncidentMetricValues(previous),
    getRmaMetricValues(current),
    getRmaMetricValues(previous),
    getRmaAgingDistribution(),
    getAgingDistribution(),
    getRmasAggregates({ dateRangeFrom: from, dateRangeTo: to }),
    getRmaStateChangeStats(current),
    getRmaOutcomeBreakdown(current),
    getProviderRmaTurnaround(current),
    getMetricReviews(weekStart),
    fetchUsersForSelect(),
  ]);

  return {
    weekStart,
    range: { from, to, prevFrom, prevTo },
    values: { ...incValues, ...rmaValues },
    prevValues: { ...incPrev, ...rmaPrev },
    rmaActive: rmaAging.openTotal,
    incidentAging,
    rmaByStatus: aggregates.byStatus.map((r) => ({
      status: r.status,
      label: RMA_STATUS_LABELS[r.status as RmaStatus] ?? r.status,
      count: r.count,
    })),
    rmaStateChangesByDay: rmaStateChanges.byDay,
    rmaOutcomes,
    rmaProviderTurnaround,
    reviews,
    users: users.map((u) => ({ id: u.id, name: u.name })),
  };
}
