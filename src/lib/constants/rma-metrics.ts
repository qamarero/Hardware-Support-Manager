/**
 * Catálogo de métricas de RMA para la pestaña "Métricas RMA" y el reporte
 * semanal (semáforo/responsable/comentario editables por métrica y semana).
 *
 * Los VALORES se calculan en vivo (ver `src/server/queries/rma-metrics.ts`);
 * aquí viven solo las definiciones (etiqueta, unidad, objetivo, sentido) y el
 * semáforo automático sugerido a partir del objetivo.
 */

export const RMA_SOLICITADO_TARGET_HOURS = 2;
export const RMA_AGING_THRESHOLD_DAYS = 7;

export type RmaMetricUnit = "h" | "count" | "pct";
export type RmaMetricBetter = "lower" | "higher" | "info";
export type RmaMetricStatus = "verde" | "ambar" | "rojo";

export interface RmaMetricDef {
  key: string;
  label: string;
  unit: RmaMetricUnit;
  /** Objetivo; null = informativa (sin semáforo automático). */
  target: number | null;
  betterWhen: RmaMetricBetter;
  description?: string;
}

export const RMA_METRIC_CATALOG: RmaMetricDef[] = [
  {
    key: "rma_time_to_solicitado",
    label: "Tiempo hasta tramitar",
    unit: "h",
    target: RMA_SOLICITADO_TARGET_HOURS,
    betterWhen: "lower",
    description: "Horas medias desde que se crea el RMA hasta que pasa a «Solicitado».",
  },
  {
    key: "rma_solicitado_within_target",
    label: "% tramitados en objetivo",
    unit: "pct",
    target: 90,
    betterWhen: "higher",
    description: "Porcentaje de RMA tramitados dentro del objetivo de tiempo.",
  },
  {
    key: "rma_aging_gt7",
    label: `RMA abiertos >${RMA_AGING_THRESHOLD_DAYS} días`,
    unit: "count",
    target: 0,
    betterWhen: "lower",
    description: "RMA abiertos cuya edad activa (descontando pausas) supera el umbral.",
  },
  {
    key: "rma_state_changes",
    label: "Cambios de estado",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "Transiciones de estado de RMA registradas en la semana.",
  },
  {
    key: "rma_solicitudes",
    label: "Solicitudes tramitadas",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "RMA que pasaron a «Solicitado» en la semana.",
  },
  {
    key: "rma_cerrados",
    label: "RMA cerrados",
    unit: "count",
    target: null,
    betterWhen: "info",
    description: "RMA que alcanzaron un estado de cierre en la semana.",
  },
];

export const RMA_METRIC_BY_KEY: Record<string, RmaMetricDef> = Object.fromEntries(
  RMA_METRIC_CATALOG.map((m) => [m.key, m]),
);

/**
 * Semáforo automático sugerido a partir del valor y el objetivo. Devuelve null
 * para métricas informativas o cuando no hay valor. El operador puede
 * sobrescribirlo manualmente (se guarda en `rma_metric_reviews`).
 */
export function suggestMetricStatus(
  def: RmaMetricDef,
  value: number | null,
): RmaMetricStatus | null {
  if (def.target === null || def.betterWhen === "info" || value === null) return null;

  if (def.betterWhen === "lower") {
    // Objetivo 0 → tolerancia absoluta pequeña; si no, margen del 50%.
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
