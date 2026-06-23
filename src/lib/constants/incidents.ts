export const INCIDENT_STATUSES = {
  NUEVO: "nuevo",
  EN_TRIAJE: "en_triaje",
  EN_GESTION: "en_gestion",
  ESPERANDO_CLIENTE: "esperando_cliente",
  ESPERANDO_PROVEEDOR: "esperando_proveedor",
  ESPERANDO_PIEZA: "esperando_pieza",
  RESUELTO: "resuelto",
  CERRADO: "cerrado",
  CANCELADO: "cancelado",
} as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[keyof typeof INCIDENT_STATUSES];

// Vocabulario del prototipo Qamarero (femenino, concuerda con "incidencia").
// Los identificadores internos del enum se conservan; lo que ve el técnico y
// CX (en las notas de Intercom) sale de estas etiquetas.
export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  nuevo: "Abierta",
  en_triaje: "En triaje",
  en_gestion: "En curso",
  esperando_cliente: "Esperando cliente",
  esperando_proveedor: "Esperando proveedor",
  esperando_pieza: "Esperando resolución del RMA",
  resuelto: "Resuelta",
  cerrado: "Cerrada",
  cancelado: "Cancelada",
};

export const INCIDENT_PRIORITIES = {
  BAJA: "baja",
  MEDIA: "media",
  ALTA: "alta",
  CRITICA: "critica",
} as const;

export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[keyof typeof INCIDENT_PRIORITIES];

export const INCIDENT_PRIORITY_LABELS: Record<IncidentPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const INCIDENT_CATEGORIES = {
  ESCALADO: "escalado",
  INCIDENCIA_DIRECTA: "incidencia_directa",
  MENCION: "mencion",
  OTRO: "otro",
  CONSULTA_RAPIDA: "consulta_rapida",
} as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[keyof typeof INCIDENT_CATEGORIES];

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  escalado: "Escalado",
  incidencia_directa: "Incidencia directa",
  mencion: "Mención",
  otro: "Otro",
  consulta_rapida: "Consulta rápida",
};

export const HARDWARE_ORIGINS = {
  QAMARERO: "qamarero",
  CLIENTE_RECICLADO: "cliente_reciclado",
} as const;

export type HardwareOrigin = (typeof HARDWARE_ORIGINS)[keyof typeof HARDWARE_ORIGINS];

export const HARDWARE_ORIGIN_LABELS: Record<HardwareOrigin, string> = {
  qamarero: "Qamarero",
  cliente_reciclado: "Reciclado cliente",
};
