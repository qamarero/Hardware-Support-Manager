import type { Metadata } from "next";
import {
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Clock,
  AlertOctagon,
  RefreshCcw,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { IncidentsChart } from "@/components/dashboard/incidents-chart";
import { StatusDistribution } from "@/components/dashboard/status-distribution";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AgingChart } from "@/components/dashboard/aging-chart";
import { TechnicianChart } from "@/components/dashboard/technician-chart";
import {
  getDashboardStats,
  getRecentActivity,
  getIncidentStatusDistribution,
  getIncidentTrend,
  getSlaMetrics,
  getAgingDistribution,
  getTechnicianPerformance,
} from "@/server/queries/dashboard";
import { getAlertItems } from "@/server/queries/alerts";
import { AttentionWidget } from "@/components/dashboard/attention-widget";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel de Control",
};

function formatHours(hours: number | null): string {
  if (hours === null) return "-";
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24 * 10) / 10;
  return `${days}d`;
}

export default async function DashboardPage() {
  const [stats, activity, distribution, trend, sla, aging, technicians, alerts] =
    await Promise.all([
      getDashboardStats(),
      getRecentActivity(),
      getIncidentStatusDistribution(),
      getIncidentTrend(),
      getSlaMetrics(),
      getAgingDistribution(),
      getTechnicianPerformance(),
      getAlertItems(),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Panel de Control</h1>

      {/* Row 1: KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Incidencias Abiertas"
          value={stats.openIncidents}
          icon={AlertTriangle}
          color="blue"
        />
        <KpiCard
          title="RMAs Activos"
          value={stats.activeRmas}
          icon={RotateCcw}
          color="purple"
        />
        <KpiCard
          title="SLA Cumplido"
          value={`${sla.slaCompliancePercent}%`}
          icon={ShieldCheck}
          color={sla.slaCompliancePercent >= 90 ? "green" : sla.slaCompliancePercent >= 70 ? "amber" : "red"}
        />
        <KpiCard
          title="Resolución Media"
          value={formatHours(sla.avgResolutionHours)}
          icon={Clock}
          color="amber"
        />
        <KpiCard
          title="Fuera de SLA"
          value={sla.overdueCount}
          icon={AlertOctagon}
          color={sla.overdueCount > 0 ? "red" : "green"}
        />
        <KpiCard
          title="Tasa Reapertura"
          value={`${sla.reopenRate}%`}
          icon={RefreshCcw}
          color={sla.reopenRate > 5 ? "red" : "green"}
        />
      </div>

      {/* Attention Widget */}
      {alerts.totalCount > 0 && (
        <AttentionWidget initialData={alerts} />
      )}

      {/* Row 2: Trend + Distribution */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncidentsChart data={trend} />
        </div>
        <StatusDistribution data={distribution} />
      </div>

      {/* Row 3: Aging + Technician Performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AgingChart data={aging} />
        <TechnicianChart data={technicians} />
      </div>

      {/* Row 4: Activity + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity data={activity} />
        </div>
        <QuickActions />
      </div>
    </div>
  );
}
