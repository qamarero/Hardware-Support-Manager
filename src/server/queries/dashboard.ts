import { db } from "@/lib/db";
import { incidents, rmas, providers, eventLogs } from "@/lib/db/schema";
import { eq, count, isNull, sql, desc, gte, not, inArray, and } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import { getSlaThresholds } from "./settings";

export interface DashboardStats {
  openIncidents: number;
  activeRmas: number;
  totalProviders: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userName: string | null;
  createdAt: Date;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface SlaMetrics {
  avgResolutionHours: number | null;
  slaCompliancePercent: number;
  overdueCount: number;
  reopenRate: number;
  avgRmaTurnaroundDays: number | null;
  incidentsByPriority: { priority: string; count: number }[];
}

export interface TechnicianPerformance {
  name: string;
  resolved: number;
  avgHours: number | null;
}

export interface AgingBucket {
  bucket: string;
  count: number;
}

const CLOSED_INCIDENT_STATUSES = ["cerrado", "cancelado"] as const;
const CLOSED_RMA_STATUSES = ["cerrado", "cancelado"] as const;

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [openIncidentsResult, activeRmasResult, totalProvidersResult] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(incidents)
          .where(not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES]))),
        db
          .select({ count: count() })
          .from(rmas)
          .where(not(inArray(rmas.status, [...CLOSED_RMA_STATUSES]))),
        db
          .select({ count: count() })
          .from(providers)
          .where(isNull(providers.deletedAt)),
      ]);

    return {
      openIncidents: openIncidentsResult[0].count,
      activeRmas: activeRmasResult[0].count,
      totalProviders: totalProvidersResult[0].count,
    };
  } catch {
    return { openIncidents: 0, activeRmas: 0, totalProviders: 0 };
  }
}

export async function getSlaMetrics(): Promise<SlaMetrics> {
  try {
    const sla = await getSlaThresholds();

    // Average resolution time (resolved incidents only) — subtracting paused time
    const avgResResult = await db
      .select({
        avgHours: sql<number>`avg((extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0)`,
      })
      .from(incidents)
      .where(
        and(
          eq(incidents.status, "resuelto"),
          sql`${incidents.resolvedAt} is not null`
        )
      );

    // SLA compliance: % of resolved incidents within their priority threshold (subtracting paused time)
    const complianceResult = await db
      .select({
        total: count(),
        compliant: sql<number>`count(*) filter (where
          (${incidents.priority} = 'critica' and (extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 <= ${sla.resolution.critica}) or
          (${incidents.priority} = 'alta' and (extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 <= ${sla.resolution.alta}) or
          (${incidents.priority} = 'media' and (extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 <= ${sla.resolution.media}) or
          (${incidents.priority} = 'baja' and (extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 <= ${sla.resolution.baja})
        )`,
      })
      .from(incidents)
      .where(
        and(
          inArray(incidents.status, ["resuelto", "cerrado"]),
          sql`${incidents.resolvedAt} is not null`
        )
      );

    const total = complianceResult[0].total;
    const compliant = complianceResult[0].compliant;
    const compliancePercent = total > 0 ? Math.round((compliant / total) * 100) : 100;

    // Overdue: open incidents exceeding resolution SLA for their priority (subtracting paused time)
    const overdueResult = await db
      .select({ count: count() })
      .from(incidents)
      .where(
        and(
          not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES, "resuelto"])),
          sql`(
            (${incidents.priority} = 'critica' and (extract(epoch from (now() - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 > ${sla.resolution.critica}) or
            (${incidents.priority} = 'alta' and (extract(epoch from (now() - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 > ${sla.resolution.alta}) or
            (${incidents.priority} = 'media' and (extract(epoch from (now() - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 > ${sla.resolution.media}) or
            (${incidents.priority} = 'baja' and (extract(epoch from (now() - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 > ${sla.resolution.baja})
          )`
        )
      );

    // Reopen rate: transitions from resuelto back to another state
    const reopenResult = await db
      .select({ count: count() })
      .from(eventLogs)
      .where(
        and(
          eq(eventLogs.entityType, "incident"),
          eq(eventLogs.action, "transition"),
          eq(eventLogs.fromState, "resuelto")
        )
      );
    const totalResolved = await db
      .select({ count: count() })
      .from(incidents)
      .where(inArray(incidents.status, ["resuelto", "cerrado"]));
    const reopenRate = totalResolved[0].count > 0
      ? Math.round((reopenResult[0].count / totalResolved[0].count) * 100 * 10) / 10
      : 0;

    // RMA turnaround avg
    const rmaTurnResult = await db
      .select({
        avgDays: sql<number>`avg(extract(epoch from (${rmas.updatedAt} - ${rmas.createdAt})) / 86400)`,
      })
      .from(rmas)
      .where(inArray(rmas.status, ["recibido_oficina", "cerrado"]));

    // By priority
    const byPriority = await db
      .select({
        priority: incidents.priority,
        count: count(),
      })
      .from(incidents)
      .where(not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])))
      .groupBy(incidents.priority);

    return {
      avgResolutionHours: avgResResult[0].avgHours ? Math.round(avgResResult[0].avgHours * 10) / 10 : null,
      slaCompliancePercent: compliancePercent,
      overdueCount: overdueResult[0].count,
      reopenRate,
      avgRmaTurnaroundDays: rmaTurnResult[0].avgDays ? Math.round(rmaTurnResult[0].avgDays * 10) / 10 : null,
      incidentsByPriority: byPriority,
    };
  } catch {
    return {
      avgResolutionHours: null,
      slaCompliancePercent: 100,
      overdueCount: 0,
      reopenRate: 0,
      avgRmaTurnaroundDays: null,
      incidentsByPriority: [],
    };
  }
}

export async function getAgingDistribution(): Promise<AgingBucket[]> {
  try {
    const result = await db
      .select({
        bucket: sql<string>`case
          when extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 1 then '< 1 día'
          when extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 3 then '1-3 días'
          when extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 7 then '3-7 días'
          else '7+ días'
        end`,
        count: count(),
      })
      .from(incidents)
      .where(not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])))
      .groupBy(sql`case
        when extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 1 then '< 1 día'
        when extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 3 then '1-3 días'
        when extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 7 then '3-7 días'
        else '7+ días'
      end`);

    const order = ["< 1 día", "1-3 días", "3-7 días", "7+ días"];
    return order.map((b) => ({
      bucket: b,
      count: result.find((r) => r.bucket === b)?.count ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getTechnicianPerformance(): Promise<TechnicianPerformance[]> {
  try {
    const result = await db
      .select({
        name: users.name,
        resolved: count(),
        avgHours: sql<number>`avg((extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0)`,
      })
      .from(incidents)
      .innerJoin(users, eq(incidents.assignedUserId, users.id))
      .where(
        and(
          inArray(incidents.status, ["resuelto", "cerrado"]),
          sql`${incidents.resolvedAt} is not null`
        )
      )
      .groupBy(users.name)
      .orderBy(desc(count()))
      .limit(5);

    return result.map((r) => ({
      name: r.name,
      resolved: r.resolved,
      avgHours: r.avgHours ? Math.round(r.avgHours * 10) / 10 : null,
    }));
  } catch {
    return [];
  }
}

export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  try {
    const results = await db
      .select({
        id: eventLogs.id,
        action: eventLogs.action,
        entityType: eventLogs.entityType,
        entityId: eventLogs.entityId,
        userName: users.name,
        createdAt: eventLogs.createdAt,
      })
      .from(eventLogs)
      .leftJoin(users, eq(eventLogs.userId, users.id))
      .orderBy(desc(eventLogs.createdAt))
      .limit(limit);

    return results;
  } catch {
    return [];
  }
}

export async function getIncidentStatusDistribution(): Promise<StatusDistribution[]> {
  try {
    const results = await db
      .select({
        status: incidents.status,
        count: count(),
      })
      .from(incidents)
      .where(not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])))
      .groupBy(incidents.status);

    return results;
  } catch {
    return [];
  }
}

export async function getIncidentTrend(days: number = 30): Promise<TrendPoint[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await db
      .select({
        date: sql<string>`to_char(${incidents.createdAt}::date, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(incidents)
      .where(gte(incidents.createdAt, startDate))
      .groupBy(sql`${incidents.createdAt}::date`)
      .orderBy(sql`${incidents.createdAt}::date`);

    return results;
  } catch {
    return [];
  }
}
