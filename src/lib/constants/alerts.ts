export interface AlertThresholds {
  incidentStaleDays: number;
  rmaStuckProviderDays: number;
  rmaWarehouseDays: number;
  slaWarningPercent: number;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  incidentStaleDays: 3,
  rmaStuckProviderDays: 7,
  rmaWarehouseDays: 5,
  slaWarningPercent: 80,
};

export const ALERT_THRESHOLD_LABELS: Record<keyof AlertThresholds, string> = {
  incidentStaleDays: "Incidencias sin cambio (días)",
  rmaStuckProviderDays: "RMA en proveedor (días)",
  rmaWarehouseDays: "Dispositivos en almacén (días)",
  slaWarningPercent: "Aviso SLA (%)",
};
