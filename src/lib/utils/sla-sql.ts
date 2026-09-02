import { sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import type { SlaThresholds } from "@/lib/constants/sla";
import { PAUSED_INCIDENT_STATES } from "@/lib/constants/statuses";

/**
 * Estados en los que el reloj SLA está parado, como lista SQL.
 *
 * El acumulador `sla_paused_ms` solo se suma al SALIR de una espera (ver
 * `transitionIncident`), así que la espera EN CURSO no está en él. Sin
 * descontarla aparte, una incidencia con tres semanas sin respuesta del cliente
 * consume tres semanas de SLA nuestro. De ahí que casi todas las abiertas
 * aparecieran fuera de umbral: no incumplíamos, el reloj no paraba.
 */
const PAUSED_STATES_SQL = sql`(${sql.join(
  PAUSED_INCIDENT_STATES.map((st) => sql`${st}`),
  sql`, `,
)})`;

/**
 * SQL expression: elapsed hours since creation, minus paused time — including
 * the pause currently in progress.
 * Used for OPEN incidents (compares against now()).
 */
export function slaElapsedHours(
  createdAtCol: AnyColumn,
  slaPausedMsCol: AnyColumn,
  statusCol: AnyColumn,
  stateChangedAtCol: AnyColumn,
): SQL<number> {
  return sql<number>`(extract(epoch from (now() - ${createdAtCol})) * 1000
    - CAST(${slaPausedMsCol} AS bigint)
    - CASE WHEN ${statusCol} IN ${PAUSED_STATES_SQL}
           THEN extract(epoch from (now() - ${stateChangedAtCol})) * 1000
           ELSE 0 END) / 3600000.0`;
}

/**
 * SQL expression: resolution hours (resolved_at - created_at), minus paused time.
 * Used for CLOSED/RESOLVED incidents.
 */
export function slaResolvedHours(
  createdAtCol: AnyColumn,
  resolvedAtCol: AnyColumn,
  slaPausedMsCol: AnyColumn,
): SQL<number> {
  return sql<number>`(extract(epoch from (${resolvedAtCol} - ${createdAtCol})) * 1000 - CAST(${slaPausedMsCol} AS bigint)) / 3600000.0`;
}

/**
 * Build a SQL condition that checks SLA status per priority level.
 *
 * @param mode
 *   - 'exceeded': elapsed > threshold (overdue)
 *   - 'within': elapsed <= threshold (compliant)
 *   - 'warning': elapsed > (threshold * warningPct/100) AND elapsed <= threshold
 */
export function buildSlaPriorityCondition(
  priorityCol: AnyColumn,
  hoursExpr: SQL<number>,
  sla: SlaThresholds,
  mode: "exceeded" | "within" | "warning",
  warningPercent?: number,
): SQL {
  const priorities = ["critica", "alta", "media", "baja"] as const;

  const parts = priorities.map((p) => {
    const limit = sla.resolution[p];
    if (mode === "exceeded") {
      return sql`(${priorityCol} = ${p} AND ${hoursExpr} > ${limit})`;
    }
    if (mode === "within") {
      return sql`(${priorityCol} = ${p} AND ${hoursExpr} <= ${limit})`;
    }
    // mode === "warning"
    const warnPct = warningPercent ?? 80;
    const warnThreshold = (limit * warnPct) / 100;
    return sql`(${priorityCol} = ${p} AND ${hoursExpr} > ${warnThreshold} AND ${hoursExpr} <= ${limit})`;
  });

  return sql`(${sql.join(parts, sql` OR `)})`;
}

/**
 * Raw SQL version of slaElapsedHours for use inside db.execute() templates.
 * References column names directly (not Drizzle column objects), so the query
 * must expose `status` and `state_changed_at`.
 */
export function slaElapsedHoursRaw(): SQL<number> {
  return sql<number>`(extract(epoch from (now() - created_at)) * 1000
    - CAST(sla_paused_ms AS bigint)
    - CASE WHEN status IN ${PAUSED_STATES_SQL}
           THEN extract(epoch from (now() - state_changed_at)) * 1000
           ELSE 0 END) / 3600000.0`;
}

/**
 * Raw SQL version of slaResolvedHours for use inside db.execute() templates.
 */
export function slaResolvedHoursRaw(): SQL<number> {
  return sql<number>`(extract(epoch from (resolved_at - created_at)) * 1000 - CAST(sla_paused_ms AS bigint)) / 3600000.0`;
}

/**
 * Raw SQL SLA condition for use inside db.execute() templates.
 * Checks each priority against its threshold.
 */
export function buildSlaPriorityConditionRaw(
  sla: SlaThresholds,
  hoursExpr: SQL<number>,
  mode: "exceeded" | "within" | "warning",
  warningPercent?: number,
): SQL {
  const priorities = ["critica", "alta", "media", "baja"] as const;

  const parts = priorities.map((p) => {
    const limit = sla.resolution[p];
    if (mode === "exceeded") {
      return sql`(priority = ${p} AND ${hoursExpr} > ${limit})`;
    }
    if (mode === "within") {
      return sql`(priority = ${p} AND ${hoursExpr} <= ${limit})`;
    }
    const warnPct = warningPercent ?? 80;
    const warnThreshold = (limit * warnPct) / 100;
    return sql`(priority = ${p} AND ${hoursExpr} > ${warnThreshold} AND ${hoursExpr} <= ${limit})`;
  });

  return sql`(${sql.join(parts, sql` OR `)})`;
}
