import { sql, and, eq, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventLogs, incidents, clients, users } from "@/lib/db/schema";
import type { DateRangeParams } from "@/lib/utils/date-conditions";
import { getSlaMetrics, getDashboardStats, getAgingDistribution } from "@/server/queries/dashboard";

/**
 * KPIs de INCIDENCIAS para el reporte de soporte (pestaña + endpoint). Reutiliza
 * las queries del dashboard (SLA, snapshot, aging) y añade actividad de la
 * semana (cambios de estado + resueltas) desde `event_logs`/`incidents`.
 */

export async function getIncidentActivity(range?: DateRangeParams): Promise<{ stateChanges: number; resolved: number }> {
  const from = range?.dateFrom;
  const to = range?.dateTo;
  const logFrom = from ? sql`AND created_at >= ${from + "T00:00:00"}` : sql``;
  const logTo = to ? sql`AND created_at <= ${to + "T23:59:59"}` : sql``;
  const resFrom = from ? sql`AND resolved_at >= ${from + "T00:00:00"}` : sql``;
  const resTo = to ? sql`AND resolved_at <= ${to + "T23:59:59"}` : sql``;
  try {
    const res = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM hsm.event_logs
          WHERE entity_type = 'incident' AND action = 'transition' ${logFrom} ${logTo}) AS state_changes,
        (SELECT count(*)::int FROM hsm.incidents
          WHERE status IN ('resuelto','cerrado') AND resolved_at IS NOT NULL
            AND category != 'consulta_rapida' ${resFrom} ${resTo}) AS resolved
    `);
    const row = res[0] as { state_changes: number; resolved: number } | undefined;
    return {
      stateChanges: Number(row?.state_changes) || 0,
      resolved: Number(row?.resolved) || 0,
    };
  } catch {
    return { stateChanges: 0, resolved: 0 };
  }
}

// ── Informe de actividad semanal (por incidencia) ──────────────────────────

const CLOSED_STATES = ["resuelto", "cerrado", "cancelado"];
/** Acciones relevantes para el informe: creación, cambios de estado y contactos. */
const REPORT_ACTIONS = ["created", "transition", "contacted"];

export interface WeeklyIncidentEvent {
  action: string;
  fromState: string | null;
  toState: string | null;
  userName: string | null;
  createdAt: string;
  /** El evento dejó la incidencia en un estado terminal (cierre esa semana). */
  isClosure: boolean;
}

export interface WeeklyIncidentActivityRow {
  incidentId: string;
  incidentNumber: string;
  title: string;
  clientCompanyName: string | null;
  clientExternalId: string | null;
  currentStatus: string;
  resolution: string | null;
  resolutionType: string | null;
  events: WeeklyIncidentEvent[];
  stateChanges: number;
  contacts: number;
  closedThisWeek: boolean;
}

export interface WeeklyIncidentActivity {
  from: string;
  to: string;
  totals: { incidents: number; stateChanges: number; contacts: number; closed: number };
  rows: WeeklyIncidentActivityRow[];
}

/**
 * Actividad de incidencias en la semana [from, to] (fechas ISO YYYY-MM-DD),
 * agrupada POR INCIDENCIA: creación, cambios de estado, contactos al cliente y
 * cierres con su resultado. Una sola query sobre `event_logs` (join incidencias
 * + clientes) — ligera, sin riesgo de saturar el pool.
 */
export async function getWeeklyIncidentActivity(from: string, to: string): Promise<WeeklyIncidentActivity> {
  const fromTs = `${from}T00:00:00`;
  const toTs = `${to}T23:59:59`;

  const logs = await db
    .select({
      incidentId: eventLogs.entityId,
      action: eventLogs.action,
      fromState: eventLogs.fromState,
      toState: eventLogs.toState,
      userName: users.name,
      createdAt: eventLogs.createdAt,
      incidentNumber: incidents.incidentNumber,
      title: incidents.title,
      currentStatus: incidents.status,
      resolution: incidents.resolution,
      resolutionType: incidents.resolutionType,
      clientCompanyName: clients.name,
      clientExternalId: clients.externalId,
    })
    .from(eventLogs)
    .innerJoin(incidents, eq(eventLogs.entityId, incidents.id))
    .leftJoin(clients, eq(incidents.clientId, clients.id))
    .leftJoin(users, eq(eventLogs.userId, users.id))
    .where(
      and(
        eq(eventLogs.entityType, "incident"),
        inArray(eventLogs.action, REPORT_ACTIONS),
        sql`${eventLogs.createdAt} >= ${fromTs}`,
        sql`${eventLogs.createdAt} <= ${toTs}`,
      ),
    )
    .orderBy(asc(eventLogs.createdAt));

  const byIncident = new Map<string, WeeklyIncidentActivityRow>();
  for (const l of logs) {
    let row = byIncident.get(l.incidentId);
    if (!row) {
      row = {
        incidentId: l.incidentId,
        incidentNumber: l.incidentNumber,
        title: l.title,
        clientCompanyName: l.clientCompanyName,
        clientExternalId: l.clientExternalId,
        currentStatus: l.currentStatus,
        resolution: l.resolution,
        resolutionType: l.resolutionType,
        events: [],
        stateChanges: 0,
        contacts: 0,
        closedThisWeek: false,
      };
      byIncident.set(l.incidentId, row);
    }
    const isClosure = l.action === "transition" && !!l.toState && CLOSED_STATES.includes(l.toState);
    row.events.push({
      action: l.action,
      fromState: l.fromState,
      toState: l.toState,
      userName: l.userName,
      createdAt: l.createdAt.toISOString(),
      isClosure,
    });
    if (l.action === "transition") row.stateChanges += 1;
    if (l.action === "contacted") row.contacts += 1;
    if (isClosure) row.closedThisWeek = true;
  }

  const rows = [...byIncident.values()].sort((a, b) =>
    a.incidentNumber < b.incidentNumber ? 1 : -1,
  );

  return {
    from,
    to,
    totals: {
      incidents: rows.length,
      stateChanges: rows.reduce((n, r) => n + r.stateChanges, 0),
      contacts: rows.reduce((n, r) => n + r.contacts, 0),
      closed: rows.filter((r) => r.closedThisWeek).length,
    },
    rows,
  };
}

export async function getIncidentMetricValues(
  range?: DateRangeParams,
): Promise<Record<string, number | null>> {
  const [sla, stats, aging, activity] = await Promise.all([
    getSlaMetrics(range),
    getDashboardStats(),
    getAgingDistribution(),
    getIncidentActivity(range),
  ]);
  const gt7 = aging.find((b) => b.bucket === "7+ días")?.count ?? 0;
  return {
    inc_open: stats.openIncidents,
    inc_aging_gt7: gt7,
    inc_sla_compliance: sla.slaCompliancePercent,
    inc_avg_resolution_h: sla.avgResolutionHours,
    inc_overdue: sla.overdueCount,
    inc_resolved: activity.resolved,
    inc_state_changes: activity.stateChanges,
  };
}
