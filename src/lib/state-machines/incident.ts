import type { IncidentStatus } from "@/lib/constants/incidents";
import type { UserRole } from "@/lib/constants/roles";

export interface StateTransition {
  from: IncidentStatus;
  to: IncidentStatus;
  label: string;
  requiredRole: UserRole[];
  resolutionType?: "standard" | "derivado_rma";
}

export const INCIDENT_TRANSITIONS: StateTransition[] = [
  // From nuevo (mostrado como "Abierta"). El triaje se da por hecho al crear
  // la incidencia en la herramienta, así que se pasa directo a gestión.
  { from: "nuevo", to: "en_gestion", label: "Iniciar Gestión", requiredRole: ["admin", "technician"] },
  { from: "nuevo", to: "esperando_cliente", label: "Esperar Cliente", requiredRole: ["admin", "technician"] },
  { from: "nuevo", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From en_gestion (mostrado como "En curso"). "Derivar a RMA" NO es una
  // transición aquí: se hace con el asistente de RMA (botón "Crear RMA"), que
  // crea el RMA y deja la incidencia en "esperando_pieza" (esperando resolución
  // del RMA, con el SLA en pausa).
  { from: "en_gestion", to: "esperando_cliente", label: "Esperar Cliente", requiredRole: ["admin", "technician"] },
  { from: "en_gestion", to: "esperando_proveedor", label: "Esperar Proveedor", requiredRole: ["admin", "technician"] },
  { from: "en_gestion", to: "esperando_pieza", label: "Esperar resolución de RMA", requiredRole: ["admin", "technician"] },
  { from: "en_gestion", to: "resuelto", label: "Marcar Resuelto", requiredRole: ["admin", "technician"] },
  { from: "en_gestion", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From esperando_cliente
  { from: "esperando_cliente", to: "en_gestion", label: "Reanudar Gestión", requiredRole: ["admin", "technician"] },
  { from: "esperando_cliente", to: "esperando_pieza", label: "Esperar Pieza", requiredRole: ["admin", "technician"] },
  { from: "esperando_cliente", to: "resuelto", label: "Marcar Resuelto", requiredRole: ["admin", "technician"] },
  { from: "esperando_cliente", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From esperando_proveedor
  { from: "esperando_proveedor", to: "en_gestion", label: "Reanudar Gestión", requiredRole: ["admin", "technician"] },
  { from: "esperando_proveedor", to: "esperando_pieza", label: "Esperar Pieza", requiredRole: ["admin", "technician"] },
  { from: "esperando_proveedor", to: "resuelto", label: "Marcar Resuelto", requiredRole: ["admin", "technician"] },
  { from: "esperando_proveedor", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From esperando_pieza (incidencia derivada a RMA, esperando el repuesto/sustituto)
  { from: "esperando_pieza", to: "en_gestion", label: "Reanudar Gestión", requiredRole: ["admin", "technician"] },
  { from: "esperando_pieza", to: "resuelto", label: "Marcar Resuelto", requiredRole: ["admin", "technician"] },
  { from: "esperando_pieza", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From resuelto
  { from: "resuelto", to: "cerrado", label: "Cerrar", requiredRole: ["admin", "technician"] },
  { from: "resuelto", to: "en_gestion", label: "Reabrir", requiredRole: ["admin"] },
];

export function getAvailableTransitions(
  currentStatus: IncidentStatus,
  userRole: UserRole
): StateTransition[] {
  return INCIDENT_TRANSITIONS.filter(
    (t) => t.from === currentStatus && t.requiredRole.includes(userRole)
  );
}

export function isValidTransition(
  from: IncidentStatus,
  to: IncidentStatus,
  userRole: UserRole
): boolean {
  return INCIDENT_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.requiredRole.includes(userRole)
  );
}
