import type { RmaStatus } from "@/lib/constants/rmas";
import type { UserRole } from "@/lib/constants/roles";

export interface RmaStateTransition {
  from: RmaStatus;
  to: RmaStatus;
  label: string;
  requiredRole: UserRole[];
}

export const RMA_TRANSITIONS: RmaStateTransition[] = [
  // From borrador
  { from: "borrador", to: "solicitado", label: "Enviar Solicitud", requiredRole: ["admin", "technician"] },
  { from: "borrador", to: "cancelado", label: "Cancelar", requiredRole: ["admin", "technician"] },
  // From solicitado
  { from: "solicitado", to: "aprobado", label: "Proveedor Aprueba", requiredRole: ["admin", "technician"] },
  { from: "solicitado", to: "rechazado", label: "Proveedor Rechaza", requiredRole: ["admin", "technician"] },
  { from: "solicitado", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From aprobado
  { from: "aprobado", to: "enviado_proveedor", label: "Marcar Enviado", requiredRole: ["admin", "technician"] },
  { from: "aprobado", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From enviado_proveedor (equipo camino del proveedor)
  { from: "enviado_proveedor", to: "en_proveedor", label: "Proveedor Recibe", requiredRole: ["admin", "technician"] },
  // From en_proveedor
  { from: "en_proveedor", to: "devuelto", label: "Proveedor Devuelve", requiredRole: ["admin", "technician"] },
  { from: "en_proveedor", to: "rechazado", label: "Proveedor Rechaza", requiredRole: ["admin", "technician"] },
  // From devuelto: o lo recibimos nosotros (intermediamos) o el proveedor lo
  // envía directo al cliente (proveedor gestiona).
  { from: "devuelto", to: "recibido_oficina", label: "Recibido en Oficina", requiredRole: ["admin", "technician"] },
  { from: "devuelto", to: "entregado_cliente", label: "Entregado al Cliente (envío directo)", requiredRole: ["admin", "technician"] },
  // From recibido_oficina (lo tenemos nosotros, pendiente de devolver al cliente)
  { from: "recibido_oficina", to: "entregado_cliente", label: "Entregar al Cliente", requiredRole: ["admin", "technician"] },
  { from: "recibido_oficina", to: "esperando_cliente", label: "Esperando al Cliente", requiredRole: ["admin", "technician"] },
  { from: "recibido_oficina", to: "enviado_cliente", label: "Enviar al Cliente", requiredRole: ["admin", "technician"] },
  // From enviado_cliente (equipo camino del cliente, a la espera de que confirme — SLA en pausa)
  { from: "enviado_cliente", to: "entregado_cliente", label: "Cliente Recibe", requiredRole: ["admin", "technician"] },
  { from: "enviado_cliente", to: "recibido_oficina", label: "Corregir: volver a Recibido", requiredRole: ["admin"] },
  // From esperando_cliente (a la espera de que el cliente confirme/recoja — SLA en pausa)
  { from: "esperando_cliente", to: "entregado_cliente", label: "Entregar al Cliente", requiredRole: ["admin", "technician"] },
  { from: "esperando_cliente", to: "recibido_oficina", label: "Corregir: volver a Recibido", requiredRole: ["admin"] },
  { from: "esperando_cliente", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // From entregado_cliente
  { from: "entregado_cliente", to: "cerrado", label: "Cerrar RMA", requiredRole: ["admin", "technician"] },
  // From rechazado
  { from: "rechazado", to: "cerrado", label: "Cerrar RMA", requiredRole: ["admin", "technician"] },
  { from: "rechazado", to: "cancelado", label: "Cancelar", requiredRole: ["admin"] },
  // Correcciones (admin): retroceder un paso si nos equivocamos.
  { from: "en_proveedor", to: "enviado_proveedor", label: "Corregir: volver a Enviado", requiredRole: ["admin"] },
  { from: "recibido_oficina", to: "devuelto", label: "Corregir: volver a Devuelto", requiredRole: ["admin"] },
  { from: "entregado_cliente", to: "recibido_oficina", label: "Corregir: volver a Recibido", requiredRole: ["admin"] },
];

export function getRmaAvailableTransitions(
  currentStatus: RmaStatus,
  userRole: UserRole
): RmaStateTransition[] {
  return RMA_TRANSITIONS.filter(
    (t) => t.from === currentStatus && t.requiredRole.includes(userRole)
  );
}

export function isValidRmaTransition(
  from: RmaStatus,
  to: RmaStatus,
  userRole: UserRole
): boolean {
  return RMA_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.requiredRole.includes(userRole)
  );
}
