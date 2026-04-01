"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Clock,
  AlertOctagon,
  RefreshCcw,
} from "lucide-react";
import { KpiCard } from "./kpi-card";
import { ExpandableKpiCard } from "./expandable-kpi-card";
import { IncidentsChart } from "./incidents-chart";
import { StatusDistribution } from "./status-distribution";
import { RecentActivity } from "./recent-activity";
import { QuickActions } from "./quick-actions";
import { AgingChart } from "./aging-chart";
import { TechnicianChart } from "./technician-chart";
import { AttentionWidget } from "./attention-widget";
import { DateRangeSelector } from "./date-range-selector";
import { ExportButton } from "./export-button";
import { StaggerList } from "@/components/shared/stagger-list";
import { useDashboardParams } from "@/hooks/use-dashboard-params";
import {
  fetchDashboardStats,
  fetchSlaMetrics,
  fetchIncidentTrend,
  fetchIncidentStatusDistribution,
  fetchAgingDistribution,
  fetchTechnicianPerformance,
  fetchRecentActivity,
} from "@/server/actions/dashboard";
import { fetchAlertItems } from "@/server/actions/alerts";
import type {
  DashboardStats,
  SlaMetrics,
  TrendPoint,
  StatusDistribution as StatusDistType,
  AgingBucket,
  TechnicianPerformance as TechPerfType,
  RecentActivity as RecentActType,
} from "@/server/queries/dashboard";
import type { AlertSummary } from "@/server/queries/alerts";

function formatHours(hours: number | null): string {
  if (hours === null) return "-";
  if (hours < 24) return `${hours}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d`;
}

interface DashboardContentProps {
  initialStats: DashboardStats;
  initialSla: SlaMetrics;
  initialTrend: TrendPoint[];
  initialDistribution: StatusDistType[];
  initialAging: AgingBucket[];
  initialTechnicians: TechPerfType[];
  initialActivity: RecentActType[];
  initialAlerts: AlertSummary;
}

export function DashboardContent({
  initialStats,
  initialSla,
  initialTrend,
  initialDistribution,
  initialAging,
  initialTechnicians,
  initialActivity,
  initialAlerts,
}: DashboardContentProps) {
  const { preset, dateFrom, dateTo, dateRange, setPreset, setCustomRange } =
    useDashboardParams();

  const hasCustomRange = dateFrom || dateTo || preset !== "30d";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", dateRange],
    queryFn: () => fetchDashboardStats(dateRange),
    initialData: hasCustomRange ? undefined : initialStats,
    staleTime: 30_000,
  });

  const { data: sla } = useQuery({
    queryKey: ["dashboard-sla", dateRange],
    queryFn: () => fetchSlaMetrics(dateRange),
    initialData: hasCustomRange ? undefined : initialSla,
    staleTime: 30_000,
  });

  const { data: trend } = useQuery({
    queryKey: ["dashboard-trend", dateRange],
    queryFn: () => fetchIncidentTrend(dateRange),
    initialData: hasCustomRange ? undefined : initialTrend,
    staleTime: 30_000,
  });

  const { data: distribution } = useQuery({
    queryKey: ["dashboard-distribution", dateRange],
    queryFn: () => fetchIncidentStatusDistribution(dateRange),
    initialData: hasCustomRange ? undefined : initialDistribution,
    staleTime: 30_000,
  });

  const { data: aging } = useQuery({
    queryKey: ["dashboard-aging", dateRange],
    queryFn: () => fetchAgingDistribution(dateRange),
    initialData: hasCustomRange ? undefined : initialAging,
    staleTime: 30_000,
  });

  const { data: technicians } = useQuery({
    queryKey: ["dashboard-technicians", dateRange],
    queryFn: () => fetchTechnicianPerformance(dateRange),
    initialData: hasCustomRange ? undefined : initialTechnicians,
    staleTime: 30_000,
  });

  const { data: activity } = useQuery({
    queryKey: ["dashboard-activity", dateRange],
    queryFn: () => fetchRecentActivity(dateRange),
    initialData: hasCustomRange ? undefined : initialActivity,
    staleTime: 30_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: () => fetchAlertItems(),
    initialData: initialAlerts,
    staleTime: 60_000,
  });

  const s = stats ?? initialStats;
  const sl = sla ?? initialSla;
  const al = alerts ?? initialAlerts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Panel de Control</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeSelector
            preset={preset}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPresetChange={setPreset}
            onCustomRange={setCustomRange}
          />
          <ExportButton dateRange={dateRange} />
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StaggerList staggerMs={60}>
          <ExpandableKpiCard
            title="Incidencias Abiertas"
            value={s.openIncidents}
            icon={AlertTriangle}
            color="blue"
            drilldownType="openIncidents"
            dateRange={dateRange}
          />
          <ExpandableKpiCard
            title="RMAs Activos"
            value={s.activeRmas}
            icon={RotateCcw}
            color="purple"
            drilldownType="activeRmas"
            dateRange={dateRange}
          />
          <KpiCard
            title="SLA Cumplido"
            value={`${sl.slaCompliancePercent}%`}
            icon={ShieldCheck}
            color={
              sl.slaCompliancePercent >= 90
                ? "green"
                : sl.slaCompliancePercent >= 70
                  ? "amber"
                  : "red"
            }
          />
          <KpiCard
            title="Resolución Media"
            value={formatHours(sl.avgResolutionHours)}
            icon={Clock}
            color="amber"
          />
          <ExpandableKpiCard
            title="Fuera de SLA"
            value={sl.overdueCount}
            icon={AlertOctagon}
            color={sl.overdueCount > 0 ? "red" : "green"}
            drilldownType="overdue"
            dateRange={dateRange}
          />
          <KpiCard
            title="Tasa Reapertura"
            value={`${sl.reopenRate}%`}
            icon={RefreshCcw}
            color={sl.reopenRate > 5 ? "red" : "green"}
          />
        </StaggerList>
      </div>

      {/* Attention Widget */}
      {al.totalCount > 0 && <AttentionWidget initialData={al} />}

      {/* Row 2: Trend + Distribution */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncidentsChart data={trend ?? initialTrend} />
        </div>
        <StatusDistribution data={distribution ?? initialDistribution} />
      </div>

      {/* Row 3: Aging + Technician Performance */}
      <div className="grid gap-4 md:grid-cols-2">
        <AgingChart data={aging ?? initialAging} />
        <TechnicianChart data={technicians ?? initialTechnicians} />
      </div>

      {/* Row 4: Activity + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity data={activity ?? initialActivity} />
        </div>
        <QuickActions />
      </div>
    </div>
  );
}
