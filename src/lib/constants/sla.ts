export interface SlaThresholds {
  response: Record<string, number>;
  resolution: Record<string, number>;
}

export const DEFAULT_SLA_THRESHOLDS: SlaThresholds = {
  response: {
    critica: 4,
    alta: 8,
    media: 24,
    baja: 48,
  },
  resolution: {
    critica: 24,
    alta: 48,
    media: 168,
    baja: 336,
  },
};

export const SLA_PRIORITY_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};
