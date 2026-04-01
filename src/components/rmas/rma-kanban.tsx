"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KanbanColumn } from "@/components/incidents/kanban-column";
import { RmaKanbanCard, type RmaKanbanCardData } from "./rma-kanban-card";
import { isValidRmaTransition } from "@/lib/state-machines/rma";
import { transitionRma } from "@/server/actions/rmas";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import type { RmaRow } from "@/server/queries/rmas";

const KANBAN_STATUSES: RmaStatus[] = [
  "borrador",
  "solicitado",
  "aprobado",
  "enviado_proveedor",
  "en_proveedor",
  "devuelto",
  "recibido_oficina",
];

const STATUS_COLORS: Record<string, string> = {
  borrador: "#6b7280",
  solicitado: "#3b82f6",
  aprobado: "#22c55e",
  enviado_proveedor: "#6366f1",
  en_proveedor: "#f97316",
  devuelto: "#eab308",
  recibido_oficina: "#14b8a6",
};

function toCardData(rma: RmaRow): RmaKanbanCardData {
  const deviceInfo = [rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" ") || null;
  return {
    id: rma.id,
    rmaNumber: rma.rmaNumber,
    href: `/rmas/${rma.id}`,
    status: rma.status as RmaStatus,
    providerName: rma.providerName,
    deviceInfo,
    stateChangedAt: rma.stateChangedAt,
  };
}

interface RmaKanbanProps {
  data: RmaRow[];
}

export function RmaKanban({ data }: RmaKanbanProps) {
  const queryClient = useQueryClient();
  const [activeCard, setActiveCard] = useState<RmaKanbanCardData | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, RmaStatus>>({});

  // Require minimum 8px movement before drag starts — prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const mutation = useMutation({
    mutationFn: (vars: { rmaId: string; toStatus: string }) =>
      transitionRma({
        rmaId: vars.rmaId,
        toStatus: vars.toStatus,
      }),
    onSuccess: (_result, vars) => {
      // Remove optimistic move and refresh data
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[vars.rmaId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["rmas-kanban"] });
    },
    onError: (_error, vars) => {
      // Revert optimistic move
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[vars.rmaId];
        return next;
      });
      toast.error("Error al cambiar estado");
    },
  });

  const getEffectiveStatus = useCallback(
    (rma: RmaRow): RmaStatus => {
      return optimisticMoves[rma.id] ?? (rma.status as RmaStatus);
    },
    [optimisticMoves]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const rmaId = event.active.id as string;
      const rma = data.find((r) => r.id === rmaId);
      if (rma) setActiveCard(toCardData(rma));
    },
    [data]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);

      const { active, over } = event;
      if (!over) return;

      const rmaId = active.id as string;
      const fromStatus = active.data.current?.status as RmaStatus;
      const toStatus = over.id as RmaStatus;

      if (fromStatus === toStatus) return;

      if (!isValidRmaTransition(fromStatus, toStatus, "admin")) {
        toast.error(
          `Transición no permitida: ${RMA_STATUS_LABELS[fromStatus]} → ${RMA_STATUS_LABELS[toStatus]}`
        );
        return;
      }

      // Optimistic move
      setOptimisticMoves((prev) => ({ ...prev, [rmaId]: toStatus }));
      mutation.mutate({ rmaId, toStatus });
    },
    [mutation]
  );

  // Group RMAs by effective status
  const grouped = KANBAN_STATUSES.reduce(
    (acc, status) => {
      acc[status] = data.filter(
        (rma) =>
          getEffectiveStatus(rma) === status &&
          KANBAN_STATUSES.includes(rma.status as RmaStatus)
      );
      return acc;
    },
    {} as Record<RmaStatus, RmaRow[]>
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-2 pb-4 overflow-x-auto min-w-0">
        {KANBAN_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            id={status}
            label={RMA_STATUS_LABELS[status]}
            color={STATUS_COLORS[status] ?? "#6b7280"}
            count={grouped[status]?.length ?? 0}
          >
            {grouped[status]?.map((rma) => (
              <RmaKanbanCard key={rma.id} data={toCardData(rma)} />
            ))}
          </KanbanColumn>
        ))}
      </div>

      <DragOverlay>
        {activeCard ? <RmaKanbanCard data={activeCard} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
