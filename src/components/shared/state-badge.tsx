import { Badge } from "@/components/ui/badge";
import { INCIDENT_STATUS_LABELS, type IncidentStatus } from "@/lib/constants/incidents";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";

const INCIDENT_STATUS_COLORS: Record<IncidentStatus, string> = {
  nuevo: "bg-blue-500/15 text-blue-700 hover:bg-blue-500/15 dark:bg-blue-500/25 dark:text-blue-300",
  en_triaje: "bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/15 dark:bg-yellow-500/25 dark:text-yellow-300",
  en_diagnostico: "bg-orange-500/15 text-orange-700 hover:bg-orange-500/15 dark:bg-orange-500/25 dark:text-orange-300",
  esperando_repuesto: "bg-purple-500/15 text-purple-700 hover:bg-purple-500/15 dark:bg-purple-500/25 dark:text-purple-300",
  en_reparacion: "bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/15 dark:bg-indigo-500/25 dark:text-indigo-300",
  esperando_cliente: "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:bg-amber-500/25 dark:text-amber-300",
  resuelto: "bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:bg-green-500/25 dark:text-green-300",
  cerrado: "bg-gray-500/15 text-gray-700 hover:bg-gray-500/15 dark:bg-gray-500/25 dark:text-gray-300",
  cancelado: "bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:bg-red-500/25 dark:text-red-300",
};

const RMA_STATUS_COLORS: Record<RmaStatus, string> = {
  borrador: "bg-gray-500/15 text-gray-700 hover:bg-gray-500/15 dark:bg-gray-500/25 dark:text-gray-300",
  solicitado: "bg-blue-500/15 text-blue-700 hover:bg-blue-500/15 dark:bg-blue-500/25 dark:text-blue-300",
  aprobado_proveedor: "bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:bg-green-500/25 dark:text-green-300",
  enviado_proveedor: "bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/15 dark:bg-indigo-500/25 dark:text-indigo-300",
  recibido_proveedor: "bg-purple-500/15 text-purple-700 hover:bg-purple-500/15 dark:bg-purple-500/25 dark:text-purple-300",
  en_reparacion_proveedor: "bg-orange-500/15 text-orange-700 hover:bg-orange-500/15 dark:bg-orange-500/25 dark:text-orange-300",
  devuelto: "bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/15 dark:bg-yellow-500/25 dark:text-yellow-300",
  recibido_almacen: "bg-teal-500/15 text-teal-700 hover:bg-teal-500/15 dark:bg-teal-500/25 dark:text-teal-300",
  cerrado: "bg-gray-500/15 text-gray-700 hover:bg-gray-500/15 dark:bg-gray-500/25 dark:text-gray-300",
  cancelado: "bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:bg-red-500/25 dark:text-red-300",
};

interface IncidentStateBadgeProps {
  status: IncidentStatus;
}

export function IncidentStateBadge({ status }: IncidentStateBadgeProps) {
  return (
    <Badge variant="outline" className={INCIDENT_STATUS_COLORS[status]}>
      {INCIDENT_STATUS_LABELS[status]}
    </Badge>
  );
}

interface RmaStateBadgeProps {
  status: RmaStatus;
}

export function RmaStateBadge({ status }: RmaStateBadgeProps) {
  return (
    <Badge variant="outline" className={RMA_STATUS_COLORS[status]}>
      {RMA_STATUS_LABELS[status]}
    </Badge>
  );
}
