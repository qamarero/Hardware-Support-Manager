import { db } from "@/lib/db";
import { incidents, rmas, providers, clients } from "@/lib/db/schema";
import { count, sql, not, inArray, and, eq } from "drizzle-orm";
import { getAlertThresholds } from "./settings";
import { getSlaThresholds } from "./settings";

export interface AlertItem {
  id: string;
  type: "incident_stale" | "rma_stuck_provider" | "rma_warehouse" | "sla_warning";
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
  };
}

export interface AlertBadgeCounts {
  incidents: number;
  rmas: number;
  warehouse: number;
  total: number;
}

const CLOSED_INCIDENT_STATUSES = ["cerrado", "cancelado", "resuelto"] as const;
const CLOSED_RMA_STATUSES = ["cerrado", "cancelado"] as const;
const WAREHOUSE_STATUSES = ["borrador", "aprobado", "recibido_oficina"] as const;

export async function getAlertItems(): Promise<AlertSummary> {
  try {
    const [thresholds, sla] = await Promise.all([
      getAlertThresholds(),
      getSlaThresholds(),
    ]);

    const [staleIncidents, stuckRmas, warehouseRmas, slaWarnings] =
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
              sql`extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 > ${thresholds.incidentStaleDays}`
            )
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
              sql`extract(epoch from (now() - ${rmas.stateChangedAt})) / 86400 > ${thresholds.rmaStuckProviderDays}`
            )
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
              inArray(rmas.status, [...WAREHOUSE_STATUSES]),
              sql`extract(epoch from (now() - ${rmas.stateChangedAt})) / 86400 > ${thresholds.rmaWarehouseDays}`
            )
          )
          .orderBy(rmas.stateChangedAt),

        // 4. SLA warning: approaching deadline (> warningPct% but not yet exceeded)
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
              sql`(
                (${incidents.priority} = 'critica' and extract(epoch from (now() - ${incidents.createdAt})) / 3600 > ${sla.resolution.critica * thresholds.slaWarningPercent / 100} and extract(epoch from (now() - ${incidents.createdAt})) / 3600 <= ${sla.resolution.critica}) or
                (${incidents.priority} = 'alta' and extract(epoch from (now() - ${incidents.createdAt})) / 3600 > ${sla.resolution.alta * thresholds.slaWarningPercent / 100} and extract(epoch from (now() - ${incidents.createdAt})) / 3600 <= ${sla.resolution.alta}) or
                (${incidents.priority} = 'media' and extract(epoch from (now() - ${incidents.createdAt})) / 3600 > ${sla.resolution.media * thresholds.slaWarningPercent / 100} and extract(epoch from (now() - ${incidents.createdAt})) / 3600 <= ${sla.resolution.media}) or
                (${incidents.priority} = 'baja' and extract(epoch from (now() - ${incidents.createdAt})) / 3600 > ${sla.resolution.baja * thresholds.slaWarningPercent / 100} and extract(epoch from (now() - ${incidents.createdAt})) / 3600 <= ${sla.resolution.baja})
              )`
            )
          )
          .orderBy(incidents.createdAt),
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
          (Date.now() - new Date(i.stateChangedAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
        entityUrl: `/incidents/${i.id}`,
      })),
      ...stuckRmas.map((r) => ({
        id: r.id,
        type: "rma_stuck_provider" as const,
        number: r.number,
        title: [r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || r.providerName,
        status: r.status,
        daysSinceChange: Math.floor(
          (Date.now() - new Date(r.stateChangedAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
        entityUrl: `/rmas/${r.id}`,
      })),
      ...warehouseRmas.map((r) => ({
        id: r.id,
        type: "rma_warehouse" as const,
        number: r.number,
        title: [r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || r.clientName,
        status: r.status,
        daysSinceChange: Math.floor(
          (Date.now() - new Date(r.stateChangedAt).getTime()) / (1000 * 60 * 60 * 24)
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
          (Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
        entityUrl: `/incidents/${i.id}`,
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
      },
    };
  } catch {
    return {
      totalCount: 0,
      items: [],
      counts: { staleIncidents: 0, stuckRmas: 0, warehouseRmas: 0, slaWarnings: 0 },
    };
  }
}

export async function getAlertCounts(): Promise<AlertBadgeCounts> {
  try {
    const [thresholds, sla] = await Promise.all([
      getAlertThresholds(),
      getSlaThresholds(),
    ]);

    const [staleResult, stuckResult, warehouseResult, slaResult] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(incidents)
          .where(
            and(
              not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])),
              sql`extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 > ${thresholds.incidentStaleDays}`
            )
          ),
        db
          .select({ count: count() })
          .from(rmas)
          .where(
            and(
              eq(rmas.status, "en_proveedor"),
              sql`extract(epoch from (now() - ${rmas.stateChangedAt})) / 86400 > ${thresholds.rmaStuckProviderDays}`
            )
          ),
        db
          .select({ count: count() })
          .from(rmas)
          .where(
            and(
              inArray(rmas.status, [...WAREHOUSE_STATUSES]),
              sql`extract(epoch from (now() - ${rmas.stateChangedAt})) / 86400 > ${thresholds.rmaWarehouseDays}`
            )
          ),
        db
          .select({ count: count() })
          .from(incidents)
          .where(
            and(
              not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])),
              sql`(
                (${incidents.priority} = 'critica' and extract(epoch from (now() - ${incidents.createdAt})) / 3600 > ${sla.resolution.critica * thresholds.slaWarningPercent / 100} and extract(epoch from (now() - ${incidents.createdAt})) / 3600 <= ${sla.resolution.critica}) or
                (${incidents.priority} = 'alta' and extract(epoch from (now() - ${incidents.createdAt})) / 3600 > ${sla.resolution.alta * thresholds.slaWarningPercent / 100} and extract(epoch from (now() - ${incidents.createdAt})) / 3600 <= ${sla.resolution.alta}) or
                (${incidents.priority} = 'media' and extract(epoch from (now() - ${incidents.createdAt})) / 3600 > ${sla.resolution.media * thresholds.slaWarningPercent / 100} and extract(epoch from (now() - ${incidents.createdAt})) / 3600 <= ${sla.resolution.media}) or
                (${incidents.priority} = 'baja' and extract(epoch from (now() - ${incidents.createdAt})) / 3600 > ${sla.resolution.baja * thresholds.slaWarningPercent / 100} and extract(epoch from (now() - ${incidents.createdAt})) / 3600 <= ${sla.resolution.baja})
              )`
            )
          ),
      ]);

    const incidentCount = staleResult[0].count + slaResult[0].count;
    const rmaCount = stuckResult[0].count;
    const warehouseCount = warehouseResult[0].count;

    return {
      incidents: incidentCount,
      rmas: rmaCount,
      warehouse: warehouseCount,
      total: incidentCount + rmaCount + warehouseCount,
    };
  } catch {
    return { incidents: 0, rmas: 0, warehouse: 0, total: 0 };
  }
}
