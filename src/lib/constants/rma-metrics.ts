/**
 * Catálogo de métricas del soporte de hardware (incidencias + RMA) para la
 * pestaña "Métricas soporte" y el reporte semanal (semáforo/responsable/
 * comentario editables por métrica y semana).
 *
 * Los VALORES se calculan en vivo (ver `src/server/queries/rma-metrics.ts` y
 * `incident-metrics.ts`); aquí viven solo las definiciones (grupo, etiqueta,
 * unidad, objetivo, sentido) y el semáforo automático sugerido.
 */

export const RMA_SOLICITADO_TARGET_HOURS = 2;
export const RMA_AGING_THRESHOLD_DAYS = 7;
export const INC_AGING_THRESHOLD_DAYS = 7;
export const INC_SLA_TARGET_PCT = 90;

export type MetricGroup = "incidencias" | "rma";
export const GROUP_LABELS: Record<MetricGroup, string> = {
  incidencias: "Incidencias",
  rma: "RMA",
};

export type RmaMetricUnit = "h" | "count" | "pct";
export type RmaMetricBetter = "lower" | "higher" | "info";
export type RmaMetricStatus = "verde" | "ambar" | "rojo";

export interface MetricDef {
  key: string;
  group: MetricGroup;
  label: string;
  unit: RmaMetricUnit;
  /** Objetivo; null = informativa (sin semáforo automático). */
  target: number | null;
  betterWhen: RmaMetricBetter;
  description?: string;
}

/** Métricas de incidencias (soporte de primer nivel). */
export const INCIDENT_METRIC_CATALOG: MetricDef[] = [
  {
    key: "inc_open",
    group: "incidencias",
    label: "Incidencias abiertas",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "Incidencias sin resolver (snapshot actual).",
  },
  {
    key: "inc_aging_gt7",
    group: "incidencias",
    label: `Incidencias >${INC_AGING_THRESHOLD_DAYS} días`,
    unit: "count",
    target: 0,
    betterWhen: "lower",
    description: "Incidencias abiertas estancadas más del umbral en su estado actual.",
  },
  {
    key: "inc_sla_compliance",
    group: "incidencias",
    label: "Cumplimiento SLA",
    unit: "pct",
    target: INC_SLA_TARGET_PCT,
    betterWhen: "higher",
    description: "% de incidencias resueltas dentro de su umbral SLA en la semana.",
  },
  {
    key: "inc_avg_resolution_h",
    group: "incidencias",
    label: "Tiempo medio de resolución",
    unit: "h",
    target: null,
    betterWhen: "lower",
    description: "Horas medias hasta resolver (descontando pausas).",
  },
  {
    key: "inc_overdue",
    group: "incidencias",
    label: "Fuera de SLA (ahora)",
    unit: "count",
    target: 0,
    betterWhen: "lower",
    description: "Incidencias abiertas que ya superan su umbral SLA (snapshot).",
  },
  {
    key: "inc_resolved",
    group: "incidencias",
    label: "Incidencias resueltas",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "Incidencias resueltas/cerradas en la semana.",
  },
  {
    key: "inc_state_changes",
    group: "incidencias",
    label: "Cambios de estado",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "Transiciones de estado de incidencias en la semana.",
  },
];

/** Métricas de RMA (devoluciones al proveedor). */
export const RMA_METRIC_CATALOG: MetricDef[] = [
  {
    key: "rma_time_to_solicitado",
    group: "rma",
    label: "Tiempo hasta tramitar",
    unit: "h",
    target: RMA_SOLICITADO_TARGET_HOURS,
    betterWhen: "lower",
    description: "Horas medias desde que se crea el RMA hasta que pasa a «Solicitado».",
  },
  {
    key: "rma_solicitado_within_target",
    group: "rma",
    label: "% tramitados en objetivo",
    unit: "pct",
    target: 90,
    betterWhen: "higher",
    description: "Porcentaje de RMA tramitados dentro del objetivo de tiempo.",
  },
  {
    key: "rma_aging_gt7",
    group: "rma",
    label: `RMA abiertos >${RMA_AGING_THRESHOLD_DAYS} días`,
    unit: "count",
    target: 0,
    betterWhen: "lower",
    description: "RMA abiertos cuya edad activa (descontando pausas) supera el umbral.",
  },
  {
    key: "rma_state_changes",
    group: "rma",
    label: "Cambios de estado",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "Transiciones de estado de RMA registradas en la semana.",
  },
  {
    key: "rma_solicitudes",
    group: "rma",
    label: "Solicitudes tramitadas",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "RMA que pasaron a «Solicitado» en la semana.",
  },
  {
    key: "rma_cerrados",
    group: "rma",
    label: "RMA cerrados",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "RMA que alcanzaron un estado de cierre en la semana.",
  },
];

/** Catálogo completo del reporte de soporte (incidencias primero, luego RMA). */
export const SUPPORT_METRIC_CATALOG: MetricDef[] = [
  ...INCIDENT_METRIC_CATALOG,
  ...RMA_METRIC_CATALOG,
];

export const METRIC_BY_KEY: Record<string, MetricDef> = Object.fromEntries(
  SUPPORT_METRIC_CATALOG.map((m) => [m.key, m]),
);

/**
 * Semáforo automático sugerido a partir del valor y el objetivo. Devuelve null
 * para métricas informativas o cuando no hay valor. El operador puede
 * sobrescribirlo manualmente (se guarda en `rma_metric_reviews`).
 */
export function suggestMetricStatus(
  def: MetricDef,
  value: number | null,
): RmaMetricStatus | null {
  if (def.target === null || def.betterWhen === "info" || value === null) return null;

  if (def.betterWhen === "lower") {
    const amber = def.target === 0 ? 2 : def.target * 1.5;
    if (value <= def.target) return "verde";
    if (value <= amber) return "ambar";
    return "rojo";
  }

  // higher is better
  if (value >= def.target) return "verde";
  if (value >= def.target * 0.8) return "ambar";
  return "rojo";
}

export function formatMetricValue(unit: RmaMetricUnit, value: number | null): string {
  if (value === null) return "—";
  if (unit === "h") return `${value} h`;
  if (unit === "pct") return `${value} %`;
  return String(value);
}
