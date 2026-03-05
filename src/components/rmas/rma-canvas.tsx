"use client";

import { CanvasView, type CanvasStatus, type CanvasItem } from "@/components/shared/canvas-view";
import { EntityCard } from "@/components/shared/entity-card";
import { RmaStateBadge } from "@/components/shared/state-badge";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import type { RmaRow } from "@/server/queries/rmas";

interface RmaCanvasProps {
  data: RmaRow[];
}

const ACTIVE_STATUSES: RmaStatus[] = [
  "borrador",
  "solicitado",
  "aprobado_proveedor",
  "enviado_proveedor",
  "recibido_proveedor",
  "en_reparacion_proveedor",
  "devuelto",
  "recibido_almacen",
];

const STATUS_COLORS: Record<string, string> = {
  borrador: "#6b7280",
  solicitado: "#3b82f6",
  aprobado_proveedor: "#22c55e",
  enviado_proveedor: "#6366f1",
  recibido_proveedor: "#a855f7",
  en_reparacion_proveedor: "#f97316",
  devuelto: "#eab308",
  recibido_almacen: "#14b8a6",
};

export function RmaCanvas({ data }: RmaCanvasProps) {
  const statuses: CanvasStatus[] = ACTIVE_STATUSES.map((status) => ({
    id: status,
    label: RMA_STATUS_LABELS[status],
    color: STATUS_COLORS[status] ?? "#6b7280",
    count: data.filter((rma) => rma.status === status).length,
  }));

  const items: CanvasItem[] = data
    .filter((rma) => ACTIVE_STATUSES.includes(rma.status as RmaStatus))
    .map((rma) => {
      const deviceInfo = [rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" ");
      return {
        statusId: rma.status,
        node: (
          <EntityCard
            key={rma.id}
            number={rma.rmaNumber}
            href={`/rmas/${rma.id}`}
            title={deviceInfo || "Sin dispositivo"}
            statusBadge={<RmaStateBadge status={rma.status as RmaStatus} />}
            stateChangedAt={rma.stateChangedAt}
            relatedEntity={rma.providerName}
            relatedEntityIcon="building"
          />
        ),
      };
    });

  return <CanvasView statuses={statuses} items={items} />;
}
