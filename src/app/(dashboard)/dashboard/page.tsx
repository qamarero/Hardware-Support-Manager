import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import {
  getDashboardStats,
  getSlaMetrics,
  getQuickConsultationsStats,
} from "@/server/queries/dashboard";
import { getAlertItems } from "@/server/queries/alerts";
import { getSlaThresholds, getAlertThresholds } from "@/server/queries/settings";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import type { SlaThresholds } from "@/lib/constants/sla";
import type { AlertThresholds } from "@/lib/constants/alerts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel de Control",
};

// Cache wrappers (30s) para las 4 queries pesadas del SSR.
//
// Antes: cada navegación al dashboard reejecutaba `getSlaMetrics` (7 subqueries
// correlacionadas) + `getDashboardStats` + `getAlertItems` + `getQuickConsultationsStats`,
// saturando el pool (max=20 ahora, antes max=6). Con cache 30s, la mayoría de
// hits del mismo usuario (refresh, navegación) sirven el snapshot cacheado.
//
// Tag "dashboard" para revalidar manualmente desde server actions si hace falta
// frescura inmediata tras una mutación (ej. crear incidencia crítica). Por
// defecto los usuarios ven datos hasta 30s viejos — aceptable para un panel
// de KPIs.
const getDashboardStatsCached = unstable_cache(
  async () => getDashboardStats().catch(() => ({ openIncidents: 0, activeRmas: 0, totalProviders: 0 })),
  ["dashboard-stats-default"],
  { revalidate: 30, tags: ["dashboard"] },
);

const getSlaMetricsCached = unstable_cache(
  async (slaThresholds: SlaThresholds) =>
    getSlaMetrics(undefined, slaThresholds).catch(() => ({
      avgResolutionHours: null,
      slaCompliancePercent: 100,
      overdueCount: 0,
      reopenRate: 0,
      avgRmaTurnaroundDays: null,
      incidentsByPriority: [],
    })),
  ["dashboard-sla-default"],
  { revalidate: 30, tags: ["dashboard"] },
);

const getAlertItemsCached = unstable_cache(
  async (alertThresholds: AlertThresholds, slaThresholds: SlaThresholds) =>
    getAlertItems(alertThresholds, slaThresholds).catch(() => ({
      totalCount: 0,
      items: [],
      counts: { staleIncidents: 0, stuckRmas: 0, warehouseRmas: 0, slaWarnings: 0 },
    })),
  ["dashboard-alerts-default"],
  { revalidate: 30, tags: ["dashboard"] },
);

const getQuickConsultationsStatsCached = unstable_cache(
  async () => getQuickConsultationsStats().catch(() => ({
    count: 0,
    totalMinutes: 0,
    avgMinutes: null,
    byTechnician: [],
    conversionRatePct: 0,
  })),
  ["dashboard-quick-consultations-default"],
  { revalidate: 30, tags: ["dashboard"] },
);

export default async function DashboardPage() {
  // Prefetch settings once (2 queries), then reuse for all downstream queries.
  // This avoids 3 redundant settings fetches that previously happened inside each query.
  const [slaThresholds, alertThresholds] = await Promise.all([
    getSlaThresholds(),
    getAlertThresholds(),
  ]);

  // Only await critical KPI data server-side for instant page render.
  // Charts and activity data load client-side via TanStack Query.
  const [stats, sla, alerts, quickConsultations] = await Promise.all([
    getDashboardStatsCached(),
    getSlaMetricsCached(slaThresholds),
    getAlertItemsCached(alertThresholds, slaThresholds),
    getQuickConsultationsStatsCached(),
  ]);

  return (
    <DashboardContent
      initialStats={stats}
      initialSla={sla}
      initialAlerts={alerts}
      initialQuickConsultations={quickConsultations}
    />
  );
}
