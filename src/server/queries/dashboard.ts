import { db } from "@/lib/db";
import { incidents, eventLogs, users } from "@/lib/db/schema";
import { eq, count, sql, desc, gte, lte, not, inArray, and } from "drizzle-orm";
import { getSlaThresholds } from "./settings";
import type { SlaThresholds } from "@/lib/constants/sla";
import { CLOSED_INCIDENT_STATUSES } from "@/lib/constants/statuses";
import { incidentDateConds, rawDateFragments } from "@/lib/utils/date-conditions";
import {
  slaElapsedHours,
  slaResolvedHours,
  slaElapsedHoursRaw,
  slaResolvedHoursRaw,
  buildSlaPriorityCondition,
  buildSlaPriorityConditionRaw,
} from "@/lib/utils/sla-sql";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DateRangeParams {
  dateFrom?: string;
  dateTo?: string;
}

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

export interface QuickConsultationByTechnician {
  name: string;
  count: number;
  totalMinutes: number;
}

export interface QuickConsultationsStats {
  /** Consultas rápidas creadas en el periodo. */
  count: number;
  /** Suma de quick_duration_minutes (ignora null). */
  totalMinutes: number;
  /** Promedio en minutos. null si no hay datos con duración registrada. */
  avgMinutes: number | null;
  /** Top 5 técnicos por count. */
  byTechnician: QuickConsultationByTechnician[];
  /** % de consultas creadas en el periodo que después se convirtieron en formal. */
  conversionRatePct: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getDashboardStats(
  _range?: DateRangeParams,
): Promise<DashboardStats> {
  // NOTE: `range` se acepta por compatibilidad con la API existente pero NO
  // se aplica a los conteos de "abiertas/activas". Estas son métricas
  // SNAPSHOT del estado actual del depto: una incidencia creada en marzo
  // que sigue en "esperando_cliente" hoy debe contar como abierta hoy,
  // independientemente del rango temporal seleccionado en el dashboard.
  // El filtro temporal solo aplica a métricas de actividad (resueltas en
  // periodo, throughput, avg resolution) en `getSlaMetrics`.
  void _range;
  const defaults: DashboardStats = { openIncidents: 0, activeRmas: 0, totalProviders: 0 };
  try {
    const result = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM hsm.incidents
         WHERE status NOT IN ('resuelto','cerrado','cancelado')
        ) AS open_incidents,
        (SELECT count(*) FROM hsm.rmas
         WHERE status NOT IN ('recibido_oficina','cerrado','cancelado')
        ) AS active_rmas,
        (SELECT count(*) FROM hsm.providers
         WHERE deleted_at IS NULL
        ) AS total_providers
    `);

    const row = result[0] as Record<string, string> | undefined;
    if (!row) return defaults;

    return {
      openIncidents: Number(row.open_incidents) || 0,
      activeRmas: Number(row.active_rmas) || 0,
      totalProviders: Number(row.total_providers) || 0,
    };
  } catch {
    return defaults;
  }
}

export async function getSlaMetrics(
  range?: DateRangeParams,
  preloadedSla?: SlaThresholds,
): Promise<SlaMetrics> {
  const defaults: SlaMetrics = {
    avgResolutionHours: null,
    slaCompliancePercent: 100,
    overdueCount: 0,
    reopenRate: 0,
    avgRmaTurnaroundDays: null,
    incidentsByPriority: [],
  };

  try {
    const sla = preloadedSla ?? (await getSlaThresholds());
    const { incFrom, incTo, logFrom, logTo, rmaFrom, rmaTo } = rawDateFragments(range);

    // Shared SLA expressions from the helper — single source of truth
    const resolvedHoursExpr = slaResolvedHoursRaw();
    const elapsedHoursExpr = slaElapsedHoursRaw();
    const complianceCondition = buildSlaPriorityConditionRaw(sla, resolvedHoursExpr, "within");
    const overdueCondition = buildSlaPriorityConditionRaw(sla, elapsedHoursExpr, "exceeded");

    // Single query with 7 scalar subqueries
    // NOTE: las queries que miden "actividad de resolución" excluyen
    // `category='consulta_rapida'` para no distorsionar los promedios. Las
    // consultas rápidas se crean ya resueltas (resolved_at = created_at) y
    // sesgarían avg_hours/sla compliance hacia valores artificialmente buenos.
    // Sus métricas viven en getQuickConsultationsStats.
    const result = await db.execute(sql`
      SELECT
        (SELECT avg(${resolvedHoursExpr})
         FROM hsm.incidents
         WHERE status = 'resuelto' AND resolved_at IS NOT NULL
         AND category != 'consulta_rapida'
         ${incFrom} ${incTo}
        ) AS avg_hours,

        (SELECT count(*)
         FROM hsm.incidents
         WHERE status IN ('resuelto','cerrado') AND resolved_at IS NOT NULL
         AND category != 'consulta_rapida'
         ${incFrom} ${incTo}
        ) AS comp_total,

        (SELECT count(*)
         FROM hsm.incidents
         WHERE status IN ('resuelto','cerrado') AND resolved_at IS NOT NULL
         AND category != 'consulta_rapida'
         ${incFrom} ${incTo}
         AND ${complianceCondition}
        ) AS comp_compliant,

        -- overdue_count: SNAPSHOT actual (sin filtro de fecha). Una incidencia
        -- creada en marzo y todavía abierta hoy debe contar como vencida si
        -- supera su umbral SLA, independientemente del rango temporal.
        -- consulta_rapida siempre está resuelta, así que no entra aquí.
        (SELECT count(*)
         FROM hsm.incidents
         WHERE status NOT IN ('resuelto','cerrado','cancelado')
         AND ${overdueCondition}
        ) AS overdue_count,

        (SELECT count(*)
         FROM hsm.event_logs
         WHERE entity_type = 'incident' AND action = 'transition' AND from_state = 'resuelto'
         ${logFrom} ${logTo}
        ) AS reopen_count,

        (SELECT count(*)
         FROM hsm.incidents
         WHERE status IN ('resuelto','cerrado')
         AND category != 'consulta_rapida'
         ${incFrom} ${incTo}
        ) AS total_resolved,

        (SELECT avg(extract(epoch from (updated_at - created_at)) / 86400)
         FROM hsm.rmas
         WHERE status IN ('recibido_oficina','cerrado')
         ${rmaFrom} ${rmaTo}
        ) AS rma_avg_days
    `);

    const row = result[0] as Record<string, string | null> | undefined;
    if (!row) return defaults;

    const avgHours = row.avg_hours ? parseFloat(row.avg_hours) : null;
    const compTotal = Number(row.comp_total) || 0;
    const compCompliant = Number(row.comp_compliant) || 0;
    const compliancePercent = compTotal > 0
      ? Math.round((compCompliant / compTotal) * 100)
      : 100;
    const overdueCount = Number(row.overdue_count) || 0;
    const reopenCount = Number(row.reopen_count) || 0;
    const totalResolved = Number(row.total_resolved) || 0;
    // Clamp a [0,100]: la query actual cuenta EVENTOS de reopen (no incidencias
    // distintas), por lo que si una incidencia se reabre varias veces el ratio
    // puede superar 100%. Sin clamp el portal rechaza el shape (zod max(100)).
    // TODO: rediseñar la fórmula para contar incidencias distintas reabiertas
    // sobre total resueltas en el mismo universo temporal.
    const reopenRate = totalResolved > 0
      ? Math.min(100, Math.round((reopenCount / totalResolved) * 100 * 10) / 10)
      : 0;
    const rmaDays = row.rma_avg_days ? parseFloat(row.rma_avg_days) : null;

    // By priority — SNAPSHOT del estado actual. Reparto de incidencias que
    // están abiertas AHORA por prioridad, sin filtro de fecha (una crítica
    // creada en abril que sigue abierta hoy debe seguir contando).
    const byPriority = await db
      .select({
        priority: incidents.priority,
        count: count(),
      })
      .from(incidents)
      .where(not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])))
      .groupBy(incidents.priority);

    return {
      avgResolutionHours: avgHours ? Math.round(avgHours * 10) / 10 : null,
      slaCompliancePercent: compliancePercent,
      overdueCount,
      reopenRate,
      avgRmaTurnaroundDays: rmaDays ? Math.round(rmaDays * 10) / 10 : null,
      incidentsByPriority: byPriority,
    };
  } catch {
    return defaults;
  }
}

export async function getAgingDistribution(
  _range?: DateRangeParams,
): Promise<AgingBucket[]> {
  // El aging mide tiempo en estado actual (`stateChangedAt`) — debe ser un
  // SNAPSHOT de las incidencias abiertas HOY, sin filtro de fecha. Filtrar
  // por `createdAt` excluiría incidencias creadas antes del rango que
  // siguen abiertas (precisamente las más viejas, que son las que más
  // importa visualizar en aging).
  void _range;
  try {
    const bucketExpr = sql`CASE
      WHEN extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 1 THEN '< 1 día'
      WHEN extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 3 THEN '1-3 días'
      WHEN extract(epoch from (now() - ${incidents.stateChangedAt})) / 86400 < 7 THEN '3-7 días'
      ELSE '7+ días'
    END`;

    const result = await db
      .select({
        bucket: sql<string>`${bucketExpr}`,
        count: count(),
      })
      .from(incidents)
      .where(not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])))
      .groupBy(bucketExpr);

    const order = ["< 1 día", "1-3 días", "3-7 días", "7+ días"];
    return order.map((b) => ({
      bucket: b,
      count: result.find((r) => r.bucket === b)?.count ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getTechnicianPerformance(
  range?: DateRangeParams,
): Promise<TechnicianPerformance[]> {
  try {
    const dateConds = incidentDateConds(range);
    const resolvedHours = slaResolvedHours(
      incidents.createdAt,
      incidents.resolvedAt,
      incidents.slaPausedMs,
    );

    const result = await db
      .select({
        name: users.name,
        resolved: count(),
        avgHours: sql<number>`avg(${resolvedHours})`,
      })
      .from(incidents)
      .innerJoin(users, eq(incidents.assignedUserId, users.id))
      .where(
        and(
          inArray(incidents.status, ["resuelto", "cerrado"]),
          sql`${incidents.resolvedAt} IS NOT NULL`,
          ...dateConds,
        ),
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

export async function getRecentActivity(
  limit: number = 10,
  range?: DateRangeParams,
): Promise<RecentActivity[]> {
  try {
    const dateConds = range
      ? [
          ...(range.dateFrom
            ? [gte(eventLogs.createdAt, new Date(range.dateFrom + "T00:00:00"))]
            : []),
          ...(range.dateTo
            ? [lte(eventLogs.createdAt, new Date(range.dateTo + "T23:59:59"))]
            : []),
        ]
      : [];

    const whereCondition = dateConds.length > 0 ? and(...dateConds) : undefined;

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
      .where(whereCondition)
      .orderBy(desc(eventLogs.createdAt))
      .limit(limit);

    return results;
  } catch {
    return [];
  }
}

export async function getIncidentStatusDistribution(
  range?: DateRangeParams,
): Promise<StatusDistribution[]> {
  try {
    const dateConds = incidentDateConds(range);

    const results = await db
      .select({
        status: incidents.status,
        count: count(),
      })
      .from(incidents)
      .where(
        and(not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])), ...dateConds),
      )
      .groupBy(incidents.status);

    return results;
  } catch {
    return [];
  }
}

export async function getIncidentTrend(
  range?: DateRangeParams,
): Promise<TrendPoint[]> {
  try {
    const days = 30;
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - days);

    const fromDate = range?.dateFrom
      ? new Date(range.dateFrom + "T00:00:00")
      : defaultFrom;
    const toDate = range?.dateTo
      ? new Date(range.dateTo + "T23:59:59")
      : undefined;

    const conditions = [gte(incidents.createdAt, fromDate)];
    if (toDate) conditions.push(lte(incidents.createdAt, toDate));

    const results = await db
      .select({
        date: sql<string>`to_char(${incidents.createdAt}::date, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(incidents)
      .where(and(...conditions))
      .groupBy(sql`${incidents.createdAt}::date`)
      .orderBy(sql`${incidents.createdAt}::date`);

    return results;
  } catch {
    return [];
  }
}

/**
 * Estadísticas de consultas rápidas (category='consulta_rapida') en el rango.
 *
 * Mide la "carga oculta" del depto: count + tiempo total invertido +
 * distribución por técnico + tasa de conversión a incidencia formal.
 *
 * Filtra por `created_at` en rango porque las consultas se crean ya resueltas
 * (created_at = resolved_at), así que ambos filtros son equivalentes.
 */
export async function getQuickConsultationsStats(
  range?: DateRangeParams,
): Promise<QuickConsultationsStats> {
  const defaults: QuickConsultationsStats = {
    count: 0,
    totalMinutes: 0,
    avgMinutes: null,
    byTechnician: [],
    conversionRatePct: 0,
  };

  try {
    const dateConds = incidentDateConds(range);

    // Aggregate: count + suma minutos + avg.
    const [agg] = await db
      .select({
        count: count(),
        totalMinutes: sql<number>`coalesce(sum(${incidents.quickDurationMinutes}), 0)`,
        avgMinutes: sql<number | null>`avg(${incidents.quickDurationMinutes})`,
      })
      .from(incidents)
      .where(
        and(eq(incidents.category, "consulta_rapida"), ...dateConds),
      );

    const total = Number(agg?.count) || 0;
    const totalMin = Number(agg?.totalMinutes) || 0;
    const avgMin =
      agg?.avgMinutes != null ? Math.round(Number(agg.avgMinutes) * 10) / 10 : null;

    // Top 5 técnicos por count + suma minutos.
    const techRows = await db
      .select({
        name: users.name,
        count: count(),
        totalMinutes: sql<number>`coalesce(sum(${incidents.quickDurationMinutes}), 0)`,
      })
      .from(incidents)
      .innerJoin(users, eq(incidents.assignedUserId, users.id))
      .where(
        and(eq(incidents.category, "consulta_rapida"), ...dateConds),
      )
      .groupBy(users.name)
      .orderBy(desc(count()))
      .limit(5);

    const byTechnician: QuickConsultationByTechnician[] = techRows.map((r) => ({
      name: r.name,
      count: Number(r.count) || 0,
      totalMinutes: Number(r.totalMinutes) || 0,
    }));

    // Conversion rate: count(event_logs WHERE action='converted_from_quick' AND
    // created_at IN range) / count(consultas creadas en range).
    let conversions = 0;
    if (total > 0 && range?.dateFrom && range?.dateTo) {
      const convResult = await db.execute(sql`
        SELECT count(*)::int AS c
        FROM hsm.event_logs
        WHERE entity_type = 'incident'
          AND action = 'converted_from_quick'
          AND created_at >= ${range.dateFrom + "T00:00:00"}
          AND created_at <= ${range.dateTo + "T23:59:59"}
      `);
      const row = convResult[0] as { c?: number | string } | undefined;
      conversions = Number(row?.c) || 0;
    }
    const conversionRatePct =
      total > 0 ? Math.round((conversions / total) * 1000) / 10 : 0;

    return {
      count: total,
      totalMinutes: totalMin,
      avgMinutes: avgMin,
      byTechnician,
      conversionRatePct,
    };
  } catch {
    return defaults;
  }
}
