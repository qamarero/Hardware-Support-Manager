export interface SlaThresholds {
  response: Record<string, number>;
  resolution: Record<string, number>;
}

export const DEFAULT_SLA_THRESHOLDS: SlaThresholds = {
  response: {
    critica: 2,
    alta: 4,
    media: 8,
    baja: 24,
  },
  resolution: {
    critica: 8,
    alta: 24,
    media: 72,
    baja: 168,
  },
};

export const SLA_PRIORITY_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};
