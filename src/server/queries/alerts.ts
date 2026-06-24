import { db } from "@/lib/db";
import { incidents, rmas, providers, clients, supportSubmissions } from "@/lib/db/schema";
import { sql, not, inArray, and, eq } from "drizzle-orm";
import { incidentDateConds, rmaDateConds } from "@/lib/utils/date-conditions";
import { getAlertThresholds, getSlaThresholds } from "./settings";
import type { AlertThresholds } from "@/lib/constants/alerts";
import type { SlaThresholds } from "@/lib/constants/sla";
import {
  slaElapsedHours,
  slaElapsedHoursRaw,
  buildSlaPriorityCondition,
  buildSlaPriorityConditionRaw,
} from "@/lib/utils/sla-sql";
import type { DateRangeParams } from "@/hooks/use-dashboard-params";
import { CLOSED_INCIDENT_STATUSES, WAREHOUSE_RMA_STATUSES } from "@/lib/constants/statuses";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AlertItem {
  id: string;
  type: "incident_stale" | "rma_stuck_provider" | "rma_warehouse" | "sla_warning" | "support_submission";
  number: string;
  title?: string | null;
  status: string;
  priority?: string | null;
  daysSinceChange: number;
  entityUrl: string;
}

export interface AlertSummary {
  totalCount: number;
  items: AlertItem[];
  counts: {
    staleIncidents: number;
    stuckRmas: number;
    warehouseRmas: number;
    slaWarnings: number;
    pendingSubmissions: number;
  };
}

export interface AlertBadgeCounts {
  incidents: number;
  rmas: number;
  warehouse: number;
  intercom: number;
  submissions: number;
  total: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getAlertItems(
  preloadedThresholds?: AlertThresholds,
  preloadedSla?: SlaThresholds,
  range?: DateRangeParams,
): Promise<AlertSummary> {
  const emptyResult: AlertSummary = {
    totalCount: 0,
    items: [],
    counts: { staleIncidents: 0, stuckRmas: 0, warehouseRmas: 0, slaWarnings: 0, pendingSubmissions: 0 },
  };

  try {
    const [thresholds, sla] = await Promise.all([
      preloadedThresholds ?? getAlertThresholds(),
      preloadedSla ?? getSlaThresholds(),
    ]);

    const incDateConds = incidentDateConds(range);
    const rmaDateCondsArr = rmaDateConds(range);

    // SLA expression using the shared helper — accounts for sla_paused_ms
    const elapsedHours = slaElapsedHours(incidents.createdAt, incidents.slaPausedMs);
    const slaWarningCondition = buildSlaPriorityCondition(
      incidents.priority,
      elapsedHours,
      sla,
      "warning",
      thresholds.slaWarningPercent,
    );

    const [staleIncidents, stuckRmas, warehouseRmas, slaWarnings, pendingSubmissions] =
      await Promise.all([
        // 1. Stale incidents: no state change > N days
        db
          .select({
            id: incidents.id,
            number: incidents.incidentNumber,
            title: incidents.title,
            status: incidents.status,
            priority: incidents.priority,
            stateChangedAt: incidents.stateChangedAt,
          })
          .from(incidents)
          .where(
            and(
              not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])),
              sql`extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 > ${thresholds.incidentStaleDays}`,
              ...incDateConds,
            ),
          )
          .orderBy(incidents.stateChangedAt),

        // 2. RMAs stuck with provider > N days
        db
          .select({
            id: rmas.id,
            number: rmas.rmaNumber,
            status: rmas.status,
            deviceBrand: rmas.deviceBrand,
            deviceModel: rmas.deviceModel,
            providerName: providers.name,
            stateChangedAt: rmas.stateChangedAt,
          })
          .from(rmas)
          .leftJoin(providers, eq(rmas.providerId, providers.id))
          .where(
            and(
              eq(rmas.status, "en_proveedor"),
              sql`extract(epoch from (now() - ${rmas.stateChangedAt})) / 86400 > ${thresholds.rmaStuckProviderDays}`,
              ...rmaDateCondsArr,
            ),
          )
          .orderBy(rmas.stateChangedAt),

        // 3. RMAs in warehouse too long > N days
        db
          .select({
            id: rmas.id,
            number: rmas.rmaNumber,
            status: rmas.status,
            deviceBrand: rmas.deviceBrand,
            deviceModel: rmas.deviceModel,
            clientName: clients.name,
            stateChangedAt: rmas.stateChangedAt,
          })
          .from(rmas)
          .leftJoin(clients, eq(rmas.clientId, clients.id))
          .where(
            and(
              inArray(rmas.status, [...WAREHOUSE_RMA_STATUSES]),
              sql`extract(epoch from (now() - ${rmas.stateChangedAt})) / 86400 > ${thresholds.rmaWarehouseDays}`,
              ...rmaDateCondsArr,
            ),
          )
          .orderBy(rmas.stateChangedAt),

        // 4. SLA warning: approaching deadline — NOW uses sla_paused_ms via shared helper
        db
          .select({
            id: incidents.id,
            number: incidents.incidentNumber,
            title: incidents.title,
            status: incidents.status,
            priority: incidents.priority,
            createdAt: incidents.createdAt,
          })
          .from(incidents)
          .where(
            and(
              not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])),
              slaWarningCondition,
              ...incDateConds,
            ),
          )
          .orderBy(incidents.createdAt),

        // 5. Sumisiones del formulario público /submit pendientes de triar
        db
          .select({
            id: supportSubmissions.id,
            clientName: supportSubmissions.clientName,
            title: supportSubmissions.title,
            priority: supportSubmissions.priority,
            createdAt: supportSubmissions.createdAt,
          })
          .from(supportSubmissions)
          .where(eq(supportSubmissions.status, "pendiente"))
          .orderBy(supportSubmissions.createdAt),
      ]);

    const items: AlertItem[] = [
      ...staleIncidents.map((i) => ({
        id: i.id,
        type: "incident_stale" as const,
        number: i.number,
        title: i.title,
        status: i.status,
        priority: i.priority,
        daysSinceChange: Math.floor(
          (Date.now() - new Date(i.stateChangedAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
        entityUrl: `/incidents/${i.id}`,
      })),
      ...stuckRmas.map((r) => ({
        id: r.id,
        type: "rma_stuck_provider" as const,
        number: r.number,
        title:
          [r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || r.providerName,
        status: r.status,
        daysSinceChange: Math.floor(
          (Date.now() - new Date(r.stateChangedAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
        entityUrl: `/rmas/${r.id}`,
      })),
      ...warehouseRmas.map((r) => ({
        id: r.id,
        type: "rma_warehouse" as const,
        number: r.number,
        title:
          [r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || r.clientName,
        status: r.status,
        daysSinceChange: Math.floor(
          (Date.now() - new Date(r.stateChangedAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
        entityUrl: `/rmas/${r.id}`,
      })),
      ...slaWarnings.map((i) => ({
        id: i.id,
        type: "sla_warning" as const,
        number: i.number,
        title: i.title,
        status: i.status,
        priority: i.priority,
        daysSinceChange: Math.floor(
          (Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
        entityUrl: `/incidents/${i.id}`,
      })),
      ...pendingSubmissions.map((s) => ({
        id: s.id,
        type: "support_submission" as const,
        number: s.clientName,
        title: s.title,
        status: "pendiente",
        priority: s.priority,
        daysSinceChange: Math.floor(
          (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
        entityUrl: "/submissions",
      })),
    ];

    return {
      totalCount: items.length,
      items,
      counts: {
        staleIncidents: staleIncidents.length,
        stuckRmas: stuckRmas.length,
        warehouseRmas: warehouseRmas.length,
        slaWarnings: slaWarnings.length,
        pendingSubmissions: pendingSubmissions.length,
      },
    };
  } catch {
    return emptyResult;
  }
}

export async function getAlertCounts(): Promise<AlertBadgeCounts> {
  const defaults: AlertBadgeCounts = {
    incidents: 0,
    rmas: 0,
    warehouse: 0,
    intercom: 0,
    submissions: 0,
    total: 0,
  };

  try {
    const [thresholds, sla] = await Promise.all([
      getAlertThresholds(),
      getSlaThresholds(),
    ]);

    // SLA warning condition using shared helper — accounts for sla_paused_ms
    const elapsedHoursExpr = slaElapsedHoursRaw();
    const slaWarningCond = buildSlaPriorityConditionRaw(
      sla,
      elapsedHoursExpr,
      "warning",
      thresholds.slaWarningPercent,
    );

    const result = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM hsm.incidents
         WHERE status NOT IN ('cerrado', 'cancelado', 'resuelto')
           AND extract(epoch from (now() - state_changed_at)) / 86400 > ${thresholds.incidentStaleDays}
        ) AS stale_count,
        (SELECT count(*) FROM hsm.rmas
         WHERE status = 'en_proveedor'
           AND extract(epoch from (now() - state_changed_at)) / 86400 > ${thresholds.rmaStuckProviderDays}
        ) AS stuck_count,
        (SELECT count(*) FROM hsm.rmas
         WHERE status IN ('borrador', 'aprobado', 'recibido_oficina')
           AND extract(epoch from (now() - state_changed_at)) / 86400 > ${thresholds.rmaWarehouseDays}
        ) AS warehouse_count,
        (SELECT count(*) FROM hsm.incidents
         WHERE status NOT IN ('cerrado', 'cancelado', 'resuelto')
           AND ${slaWarningCond}
        ) AS sla_count,
        (SELECT count(*) FROM hsm.intercom_inbox
         WHERE status = 'pendiente'
        ) AS intercom_count,
        (SELECT count(*) FROM hsm.support_submissions
         WHERE status = 'pendiente'
        ) AS submissions_count
    `);

    const row = result[0] as Record<string, string> | undefined;
    if (!row) return defaults;

    const staleCount = Number(row.stale_count) || 0;
    const slaCount = Number(row.sla_count) || 0;
    const stuckCount = Number(row.stuck_count) || 0;
    const warehouseCount = Number(row.warehouse_count) || 0;
    const intercomCount = Number(row.intercom_count) || 0;
    const submissionsCount = Number(row.submissions_count) || 0;
    const incidentCount = staleCount + slaCount;

    return {
      incidents: incidentCount,
      rmas: stuckCount,
      warehouse: warehouseCount,
      intercom: intercomCount,
      submissions: submissionsCount,
      total: incidentCount + stuckCount + warehouseCount + intercomCount + submissionsCount,
    };
  } catch {
    return defaults;
  }
}
