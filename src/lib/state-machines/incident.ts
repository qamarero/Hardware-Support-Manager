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
  // From nuevo
  { from: "nuevo", to: "en_triaje", label: "Iniciar Triaje", requiredRole: ["admin", "technician"] },
  { from: "nuevo", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From en_triaje
  { from: "en_triaje", to: "en_gestion", label: "Iniciar Gestión", requiredRole: ["admin", "technician"] },
  { from: "en_triaje", to: "esperando_cliente", label: "Esperar Cliente", requiredRole: ["admin", "technician"] },
  { from: "en_triaje", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From en_gestion
  { from: "en_gestion", to: "esperando_cliente", label: "Esperar Cliente", requiredRole: ["admin", "technician"] },
  { from: "en_gestion", to: "esperando_proveedor", label: "Esperar Proveedor", requiredRole: ["admin", "technician"] },
  { from: "en_gestion", to: "resuelto", label: "Marcar Resuelto", requiredRole: ["admin", "technician"] },
  { from: "en_gestion", to: "resuelto", label: "Derivar a RMA", requiredRole: ["admin", "technician"], resolutionType: "derivado_rma" },
  { from: "en_gestion", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From esperando_cliente
  { from: "esperando_cliente", to: "en_gestion", label: "Reanudar Gestión", requiredRole: ["admin", "technician"] },
  { from: "esperando_cliente", to: "resuelto", label: "Marcar Resuelto", requiredRole: ["admin", "technician"] },
  { from: "esperando_cliente", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From esperando_proveedor
  { from: "esperando_proveedor", to: "en_gestion", label: "Reanudar Gestión", requiredRole: ["admin", "technician"] },
  { from: "esperando_proveedor", to: "resuelto", label: "Marcar Resuelto", requiredRole: ["admin", "technician"] },
  { from: "esperando_proveedor", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
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
