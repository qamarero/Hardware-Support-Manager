"use server";

import { getRequiredSession } from "@/lib/auth/get-session";
import { computePeriods, weekRange } from "@/lib/utils/date-periods";
import {
  getRmaMetricValues,
  getRmaAgingDistribution,
  getRmaStateChangeStats,
  getRmaOutcomeBreakdown,
  type RmaAgingDistribution,
  type RmaStateChangeStats,
} from "@/server/queries/rma-metrics";
import { getRmasAggregates } from "@/server/queries/rmas";
import { getProviderRmaTurnaround } from "@/server/queries/analytics";
import { getMetricReviews, type MetricReviewRow } from "@/server/actions/rma-metric-reviews";
import { fetchUsersForSelect } from "@/server/actions/incidents";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";

export interface RmaMetricsDashboard {
  weekStart: string;
  range: { from: string; to: string; prevFrom: string; prevTo: string };
  values: Record<string, number | null>;
  prevValues: Record<string, number | null>;
  aging: RmaAgingDistribution;
  byStatus: { status: string; label: string; count: number }[];
  stateChanges: RmaStateChangeStats;
  outcomes: { outcome: string; count: number }[];
  providerTurnaround: { providerId: string; providerName: string; avgDays: number; rmaCount: number }[];
  reviews: MetricReviewRow[];
  users: { id: string; name: string }[];
}

/**
 * Bundle único para la pestaña "Métricas RMA": calcula los KPIs de la semana y
 * la anterior, snapshots (aging, reparto por estado), actividad (cambios de
 * estado, resultados, turnaround) y las anotaciones editables de la semana.
 */
export async function fetchRmaMetricsDashboard(weekStart: string): Promise<RmaMetricsDashboard> {
  await getRequiredSession();

  const { from, to } = weekRange(weekStart);
  const { prevFrom, prevTo } = computePeriods(from, to);
  const current = { dateFrom: from, dateTo: to };
  const previous = { dateFrom: prevFrom, dateTo: prevTo };

  const [
    values,
    prevValues,
    aging,
    aggregates,
    stateChanges,
    outcomes,
    providerTurnaround,
    reviews,
    users,
  ] = await Promise.all([
    getRmaMetricValues(current),
    getRmaMetricValues(previous),
    getRmaAgingDistribution(),
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
    values,
    prevValues,
    aging,
    byStatus: aggregates.byStatus.map((r) => ({
      status: r.status,
      label: RMA_STATUS_LABELS[r.status as RmaStatus] ?? r.status,
      count: r.count,
    })),
    stateChanges,
    outcomes,
    providerTurnaround,
    reviews,
    users: users.map((u) => ({ id: u.id, name: u.name })),
  };
}
