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
  /**
   * Universo sobre el que se mide, en una línea. Se exporta como columna del
   * CSV: sin esto, "Cumplimiento SLA 100 %" junto a "9 fuera de SLA" parecía
   * una contradicción cuando en realidad son universos disjuntos (resueltas
   * del periodo vs. abiertas al cierre).
   */
  universe?: string;
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
    description: "Incidencias sin resolver al cierre del periodo.",
    universe: "Conteo. Incidencias en estado no cerrado a la fecha de corte",
  },
  {
    key: "inc_aging_gt7",
    group: "incidencias",
    label: `Incidencias >${INC_AGING_THRESHOLD_DAYS} días`,
    unit: "count",
    target: 0,
    betterWhen: "lower",
    description: "Incidencias abiertas estancadas más del umbral en su estado a la fecha de corte.",
    universe: `Conteo. Abiertas al corte con más de ${INC_AGING_THRESHOLD_DAYS} días en su estado`,
  },
  {
    key: "inc_sla_compliance",
    group: "incidencias",
    label: "Cumplimiento SLA (resueltas del periodo)",
    unit: "pct",
    target: INC_SLA_TARGET_PCT,
    betterWhen: "higher",
    description: "% de las resueltas en el periodo que cumplieron su umbral SLA.",
    universe:
      "% sobre las resueltas o cerradas con resolved_at en el periodo (excluye consultas rápidas). 100 % si no hubo ninguna",
  },
  {
    key: "inc_avg_resolution_h",
    group: "incidencias",
    label: "Tiempo medio de resolución",
    unit: "h",
    target: null,
    betterWhen: "lower",
    description: "Horas medias hasta resolver (descontando pausas).",
    universe:
      "Media sobre las resueltas con resolved_at en el periodo (excluye consultas rápidas)",
  },
  {
    key: "inc_overdue",
    group: "incidencias",
    label: "Abiertas fuera de SLA al cierre",
    unit: "count",
    target: 0,
    betterWhen: "lower",
    description: "Incidencias que a la fecha de corte seguían abiertas habiendo superado su umbral SLA.",
    universe: "Conteo. Abiertas al corte con horas transcurridas (sin pausas) por encima del umbral de su prioridad",
  },
  {
    key: "inc_resolved",
    group: "incidencias",
    label: "Incidencias resueltas",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "Incidencias resueltas/cerradas en la semana.",
    universe: "Conteo. resolved_at dentro del periodo (excluye consultas rápidas)",
  },
  {
    key: "inc_state_changes",
    group: "incidencias",
    label: "Cambios de estado",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "Transiciones de estado de incidencias en la semana.",
    universe: "Conteo de eventos de transición registrados en el periodo",
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
    universe: "Media sobre los RMA creados en el periodo que ya han sido solicitados",
  },
  {
    key: "rma_solicitado_within_target",
    group: "rma",
    label: "% tramitados en objetivo",
    unit: "pct",
    target: 90,
    betterWhen: "higher",
    description: "Porcentaje de RMA tramitados dentro del objetivo de tiempo.",
    universe: `% sobre los RMA solicitados del periodo, objetivo ${RMA_SOLICITADO_TARGET_HOURS} h`,
  },
  {
    key: "rma_aging_gt7",
    group: "rma",
    label: `RMA abiertos >${RMA_AGING_THRESHOLD_DAYS} días`,
    unit: "count",
    target: 0,
    betterWhen: "lower",
    description: "RMA abiertos cuya edad activa (descontando pausas) supera el umbral.",
    universe: `Conteo. Activos al corte con edad activa mayor de ${RMA_AGING_THRESHOLD_DAYS} días`,
  },
  {
    key: "rma_state_changes",
    group: "rma",
    label: "Cambios de estado",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "Transiciones de estado de RMA registradas en la semana.",
    universe: "Conteo de eventos de transición registrados en el periodo",
  },
  {
    key: "rma_solicitudes",
    group: "rma",
    label: "Solicitudes tramitadas",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "RMA que pasaron a «Solicitado» en la semana.",
    universe: "Conteo de transiciones a «Solicitado» en el periodo",
  },
  {
    key: "rma_cerrados",
    group: "rma",
    label: "RMA cerrados",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "RMA que alcanzaron un estado de cierre en la semana.",
    universe: "Conteo de RMA que entraron en estado de cierre en el periodo",
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
