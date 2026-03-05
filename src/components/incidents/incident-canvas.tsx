"use client";

import { CanvasView, type CanvasStatus, type CanvasItem } from "@/components/shared/canvas-view";
import { EntityCard } from "@/components/shared/entity-card";
import { IncidentStateBadge } from "@/components/shared/state-badge";
import { INCIDENT_STATUS_LABELS, INCIDENT_PRIORITY_LABELS, type IncidentStatus, type IncidentPriority } from "@/lib/constants/incidents";
import type { IncidentRow } from "@/server/queries/incidents";

interface IncidentCanvasProps {
  data: IncidentRow[];
}

const ACTIVE_STATUSES: IncidentStatus[] = [
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

export function IncidentCanvas({ data }: IncidentCanvasProps) {
  const statuses: CanvasStatus[] = ACTIVE_STATUSES.map((status) => ({
    id: status,
    label: INCIDENT_STATUS_LABELS[status],
    color: STATUS_COLORS[status] ?? "#6b7280",
    count: data.filter((inc) => inc.status === status).length,
  }));

  const items: CanvasItem[] = data
    .filter((inc) => ACTIVE_STATUSES.includes(inc.status as IncidentStatus))
    .map((inc) => ({
      statusId: inc.status,
      node: (
        <EntityCard
          key={inc.id}
          number={inc.incidentNumber}
          href={`/incidents/${inc.id}`}
          title={inc.title}
          priorityLabel={INCIDENT_PRIORITY_LABELS[inc.priority as IncidentPriority]}
          statusBadge={<IncidentStateBadge status={inc.status as IncidentStatus} />}
          stateChangedAt={inc.stateChangedAt}
          assignedUser={inc.assignedUserName}
          relatedEntity={inc.clientName}
          relatedEntityIcon="user"
        />
      ),
    }));

  return <CanvasView statuses={statuses} items={items} />;
}
