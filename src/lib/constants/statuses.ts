/**
 * Centralized status group constants.
 *
 * Used across server queries, actions, and UI components to filter
 * incidents and RMAs by lifecycle stage. Defined once here to prevent
 * divergent copies.
 */

/** Incident statuses that represent a closed/finished lifecycle. */
export const CLOSED_INCIDENT_STATUSES = ["resuelto", "cerrado", "cancelado"] as const;

/** Incident statuses considered "active" — the inverse of CLOSED_INCIDENT_STATUSES.
 *  Used by the listings page to split incidents into Activas / Cerradas tables. */
export const OPEN_INCIDENT_STATUSES = [
  "nuevo",
  "en_triaje",
  "en_gestion",
  "esperando_cliente",
  "esperando_proveedor",
  "esperando_pieza",
] as const;

/** RMA statuses that represent a closed/finished lifecycle.
 *  El equipo ya volvió al cliente (entregado), se cerró, se canceló o el
 *  proveedor lo rechazó. `recibido_oficina` YA NO es terminal: ahora es un
 *  paso intermedio (recibido en oficina, pendiente de entregar al cliente). */
export const CLOSED_RMA_STATUSES = ["entregado_cliente", "rechazado", "cerrado", "cancelado"] as const;

/** RMA statuses considered "active" — the inverse of CLOSED_RMA_STATUSES. */
export const OPEN_RMA_STATUSES = [
  "borrador",
  "solicitado",
  "aprobado",
  "enviado_proveedor",
  "en_proveedor",
  "devuelto",
  "recibido_oficina",
  "esperando_cliente",
] as const;

/** Incident statuses where the SLA clock is paused (waiting on external party). */
export const PAUSED_INCIDENT_STATES = ["esperando_cliente", "esperando_proveedor", "esperando_pieza"] as const;

/** RMA statuses where the SLA/aging clock is paused — el equipo está fuera de
 *  nuestras manos (enviado al proveedor o en su poder) o a la espera del
 *  cliente (que confirme/recoja). */
export const PAUSED_RMA_STATES = ["enviado_proveedor", "en_proveedor", "esperando_cliente"] as const;

/** RMA statuses where the device is in the warehouse/office (not with provider). */
export const WAREHOUSE_RMA_STATUSES = ["borrador", "aprobado", "recibido_oficina"] as const;
