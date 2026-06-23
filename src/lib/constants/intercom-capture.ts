/**
 * Reglas de captura del webhook de Intercom. Configurables en Ajustes y leídas
 * por el webhook para decidir qué conversaciones entran en la bandeja.
 *
 * Una conversación se captura si coincide con CUALQUIERA de las reglas activas
 * (keyword en texto/atributos, nombre de ticket type, o tag). Lo que no coincide
 * cae como "descartada" con motivo (nada se pierde; revisable y recuperable).
 *
 * El default reproduce EXACTAMENTE el comportamiento histórico (keywords
 * "hardware"/"rma"), así que sin configurar no hay cambio de captura.
 */
export interface IntercomCaptureRules {
  /** Palabras clave (minúsculas) buscadas en subject/body/atributos/tags. */
  keywords: string[];
  /** Nombres de "ticket type" de Intercom que cuentan como de hardware/RMA. */
  ticketTypes: string[];
  /** Tags de Intercom que marcan el caso como de hardware/RMA. */
  tags: string[];
}

export const DEFAULT_INTERCOM_CAPTURE_RULES: IntercomCaptureRules = {
  keywords: ["hardware", "rma"],
  ticketTypes: [],
  tags: [],
};

export const INTERCOM_CAPTURE_RULES_KEY = "intercom_capture_rules";
