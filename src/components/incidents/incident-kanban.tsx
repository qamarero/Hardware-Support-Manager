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
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, type KanbanCardData } from "./kanban-card";
import { IncidentStateBadge } from "@/components/shared/state-badge";
import { isValidTransition } from "@/lib/state-machines/incident";
import { transitionIncident } from "@/server/actions/incidents";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_PRIORITY_LABELS,
  type IncidentStatus,
  type IncidentPriority,
} from "@/lib/constants/incidents";
import { DEFAULT_SLA_THRESHOLDS } from "@/lib/constants/sla";
import type { IncidentRow } from "@/server/queries/incidents";

const KANBAN_STATUSES: IncidentStatus[] = [
  "nuevo",
  "en_triaje",
  "en_diagnostico",
  "esperando_repuesto",
  "en_reparacion",
  "esperando_cliente",
  "resuelto",
];

const STATUS_COLORS: Record<string, string> = {
  nuevo: "#3b82f6",
  en_triaje: "#eab308",
  en_diagnostico: "#f97316",
  esperando_repuesto: "#a855f7",
  en_reparacion: "#6366f1",
  esperando_cliente: "#f59e0b",
  resuelto: "#22c55e",
};

function getSlaStatus(incident: IncidentRow): "ok" | "warning" | "overdue" {
  const slaHours = DEFAULT_SLA_THRESHOLDS.resolution[incident.priority] ?? 168;
  const elapsed = (Date.now() - new Date(incident.createdAt).getTime()) / (1000 * 60 * 60);
  if (elapsed > slaHours) return "overdue";
  if (elapsed > slaHours * 0.75) return "warning";
  return "ok";
}

function toCardData(inc: IncidentRow): KanbanCardData {
  return {
    id: inc.id,
    incidentNumber: inc.incidentNumber,
    href: `/incidents/${inc.id}`,
    title: inc.title,
    status: inc.status as IncidentStatus,
    priorityLabel: INCIDENT_PRIORITY_LABELS[inc.priority as IncidentPriority],
    statusBadge: <IncidentStateBadge status={inc.status as IncidentStatus} />,
    stateChangedAt: inc.stateChangedAt,
    assignedUser: inc.assignedUserName,
    clientName: inc.clientName,
    slaStatus: getSlaStatus(inc),
  };
}

interface IncidentKanbanProps {
  data: IncidentRow[];
}

export function IncidentKanban({ data }: IncidentKanbanProps) {
  const queryClient = useQueryClient();
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, IncidentStatus>>({});

  // Require minimum 8px movement before drag starts — prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const mutation = useMutation({
    mutationFn: (vars: { incidentId: string; toStatus: string }) =>
      transitionIncident({
        incidentId: vars.incidentId,
        toStatus: vars.toStatus,
      }),
    onSuccess: (_result, vars) => {
      // Remove optimistic move and refresh data
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[vars.incidentId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["incidents-canvas"] });
    },
    onError: (_error, vars) => {
      // Revert optimistic move
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[vars.incidentId];
        return next;
      });
      toast.error("Error al cambiar estado");
    },
  });

  const getEffectiveStatus = useCallback(
    (inc: IncidentRow): IncidentStatus => {
      return optimisticMoves[inc.id] ?? (inc.status as IncidentStatus);
    },
    [optimisticMoves]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const incidentId = event.active.id as string;
      const inc = data.find((i) => i.id === incidentId);
      if (inc) setActiveCard(toCardData(inc));
    },
    [data]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);

      const { active, over } = event;
      if (!over) return;

      const incidentId = active.id as string;
      const fromStatus = active.data.current?.status as IncidentStatus;
      const toStatus = over.id as IncidentStatus;

      if (fromStatus === toStatus) return;

      if (!isValidTransition(fromStatus, toStatus, "admin")) {
        toast.error(
          `Transición no permitida: ${INCIDENT_STATUS_LABELS[fromStatus]} → ${INCIDENT_STATUS_LABELS[toStatus]}`
        );
        return;
      }

      // Optimistic move
      setOptimisticMoves((prev) => ({ ...prev, [incidentId]: toStatus }));
      mutation.mutate({ incidentId, toStatus });
    },
    [mutation]
  );

  // Group incidents by effective status
  const grouped = KANBAN_STATUSES.reduce(
    (acc, status) => {
      acc[status] = data.filter(
        (inc) =>
          getEffectiveStatus(inc) === status &&
          KANBAN_STATUSES.includes(inc.status as IncidentStatus)
      );
      return acc;
    },
    {} as Record<IncidentStatus, IncidentRow[]>
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-2 pb-4">
        {KANBAN_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            id={status}
            label={INCIDENT_STATUS_LABELS[status]}
            color={STATUS_COLORS[status] ?? "#6b7280"}
            count={grouped[status]?.length ?? 0}
          >
            {grouped[status]?.map((inc) => (
              <KanbanCard key={inc.id} data={toCardData(inc)} />
            ))}
          </KanbanColumn>
        ))}
      </div>

      <DragOverlay>
        {activeCard ? <KanbanCard data={activeCard} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
