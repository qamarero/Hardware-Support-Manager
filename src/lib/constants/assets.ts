/**
 * Situación de un equipo físico (unidad). Cubre los dos flujos: reparación
 * (para_reparar → en_reparacion) y pool de sustitución (disponible ↔ en_cliente),
 * más la retirada (baja). Guardado en `assets.status` (varchar).
 */
export const ASSET_STATUSES = [
  "disponible",
  "en_cliente",
  "para_reparar",
  "en_reparacion",
  "baja",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  disponible: "Disponible",
  en_cliente: "En cliente",
  para_reparar: "Para reparar",
  en_reparacion: "En reparación",
  baja: "Baja",
};

/** Clase de badge proto por situación. */
export const ASSET_STATUS_BADGE: Record<AssetStatus, string> = {
  disponible: "badge--green",
  en_cliente: "badge--blue",
  para_reparar: "badge--amber",
  en_reparacion: "badge--orange",
  baja: "badge--gray",
};

export function assetStatusLabel(status: string | null | undefined): string {
  // "en_oficina" es el valor antiguo (previo a las situaciones) → Disponible.
  if (!status || status === "en_oficina") return "Disponible";
  return ASSET_STATUS_LABELS[status as AssetStatus] ?? status;
}

/** Clase de badge para una situación (tolera el valor antiguo "en_oficina"). */
export function assetStatusBadgeClass(status: string | null | undefined): string {
  if (!status || status === "en_oficina") return "badge--green";
  return ASSET_STATUS_BADGE[status as AssetStatus] ?? "badge--gray";
}

/**
 * "Dónde está" derivado de la situación: en cliente → el cliente; en reparación
 * → el proveedor; baja → nada; resto → ubicación o "Almacén".
 */
export function assetWhereabouts(status: string | null, clientName: string | null, location: string | null): string {
  switch (status) {
    case "en_cliente":
      return clientName?.trim() || "Cliente";
    case "en_reparacion":
      return "Proveedor";
    case "baja":
      return "—";
    default:
      return location?.trim() || "Almacén";
  }
}

/** Acciones del historial de un equipo. */
export const ASSET_EVENT_LABELS: Record<string, string> = {
  created: "Registrado",
  status_change: "Cambio de situación",
  assigned: "Asignado a cliente",
  returned: "Devuelto",
  note: "Nota",
};
