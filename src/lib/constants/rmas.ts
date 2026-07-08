export const RMA_STATUSES = {
  BORRADOR: "borrador",
  SOLICITADO: "solicitado",
  APROBADO: "aprobado",
  ENVIADO_PROVEEDOR: "enviado_proveedor",
  EN_PROVEEDOR: "en_proveedor",
  DEVUELTO: "devuelto",
  RECIBIDO_OFICINA: "recibido_oficina",
  ENVIADO_CLIENTE: "enviado_cliente",
  ESPERANDO_CLIENTE: "esperando_cliente",
  ENTREGADO_CLIENTE: "entregado_cliente",
  RECHAZADO: "rechazado",
  CERRADO: "cerrado",
  CANCELADO: "cancelado",
} as const;

export type RmaStatus = (typeof RMA_STATUSES)[keyof typeof RMA_STATUSES];

export const RMA_STATUS_LABELS: Record<RmaStatus, string> = {
  borrador: "Borrador",
  solicitado: "Solicitado",
  aprobado: "Aprobado por Proveedor",
  enviado_proveedor: "Enviado a Proveedor",
  en_proveedor: "En Proveedor",
  devuelto: "Devuelto",
  recibido_oficina: "Recibido en Oficina",
  enviado_cliente: "Enviado al Cliente",
  esperando_cliente: "Esperando al Cliente",
  entregado_cliente: "Entregado al Cliente",
  rechazado: "Rechazado por Proveedor",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

// ─── Campos granulares para métricas (A8) ────────────────────────────────────

/** Cómo terminó el RMA. */
export const RMA_OUTCOMES = {
  REPARADO: "reparado",
  SUSTITUIDO: "sustituido",
  ABONO: "abono",
  RECHAZADO: "rechazado",
  SIN_SOLUCION: "sin_solucion",
  SUSTITUCION_DIRECTA: "sustitucion_directa",
} as const;
export type RmaOutcome = (typeof RMA_OUTCOMES)[keyof typeof RMA_OUTCOMES];
export const RMA_OUTCOME_LABELS: Record<RmaOutcome, string> = {
  reparado: "Reparado",
  sustituido: "Sustituido",
  abono: "Abono / crédito",
  rechazado: "Rechazado",
  sin_solucion: "Sin solución",
  sustitucion_directa: "Sustitución directa",
};

/** Quién mueve el equipo. */
export const RMA_LOGISTICS = {
  PROVEEDOR_GESTIONA: "proveedor_gestiona",
  NOSOTROS_INTERMEDIAMOS: "nosotros_intermediamos",
} as const;
export type RmaLogistics = (typeof RMA_LOGISTICS)[keyof typeof RMA_LOGISTICS];
export const RMA_LOGISTICS_LABELS: Record<RmaLogistics, string> = {
  proveedor_gestiona: "Proveedor recoge y envía",
  nosotros_intermediamos: "Nosotros recogemos y enviamos",
};

/** Vía de reparación. */
export const RMA_REPAIR_PATHS = {
  INTERNA_HWTOOL: "interna_hwtool",
  PROVEEDOR: "proveedor",
} as const;
export type RmaRepairPath = (typeof RMA_REPAIR_PATHS)[keyof typeof RMA_REPAIR_PATHS];
export const RMA_REPAIR_PATH_LABELS: Record<RmaRepairPath, string> = {
  interna_hwtool: "Reparación interna",
  proveedor: "Proveedor",
};
