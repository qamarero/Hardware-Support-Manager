"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { IncidentRow } from "@/server/queries/incidents";
import { IncidentStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import { Badge } from "@/components/ui/badge";
import { INCIDENT_PRIORITY_LABELS, type IncidentPriority } from "@/lib/constants/incidents";
import { formatDate } from "@/lib/utils/date-format";
import { IncidentPreviewPopover } from "./incident-preview";
import { AssigneeQuickPicker } from "./assignee-quick-picker";

const PRIORITY_COLORS: Record<string, string> = {
  baja: "bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:bg-green-500/25 dark:text-green-300",
  media: "bg-blue-500/15 text-blue-700 hover:bg-blue-500/15 dark:bg-blue-500/25 dark:text-blue-300",
  alta: "bg-orange-500/15 text-orange-700 hover:bg-orange-500/15 dark:bg-orange-500/25 dark:text-orange-300",
  critica: "bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:bg-red-500/25 dark:text-red-300",
};

/** Columns hidden on mobile (<768px) to avoid horizontal scroll */
export const INCIDENT_MOBILE_HIDDEN_COLUMNS: Record<string, boolean> = {
  preview: false,
  clientName: false,
  assignedUserName: false,
  createdAt: false,
};

export const incidentColumns: ColumnDef<IncidentRow, unknown>[] = [
  {
    accessorKey: "incidentNumber",
    header: "Número",
    meta: { sortKey: "incidentNumber" },
    cell: ({ row }) => (
      <Link
        href={`/incidents/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.incidentNumber}
      </Link>
    ),
  },
  {
    id: "preview",
    header: "",
    cell: ({ row }) => <IncidentPreviewPopover incident={row.original} />,
  },
  {
    accessorKey: "clientName",
    header: "Cliente",
    cell: ({ row }) => {
      const name = row.original.clientCompanyName ?? row.original.clientName;
      if (!name) return "-";
      if (row.original.clientId) {
        return (
          <Link
            href={`/clients/${row.original.clientId}`}
            className="text-primary hover:underline"
          >
            {name}
          </Link>
        );
      }
      return name;
    },
  },
  {
    accessorKey: "title",
    header: "Título",
    meta: { sortKey: "title" },
    cell: ({ row }) => {
      const isQuick = row.original.category === "consulta_rapida";
      return (
        <span className="flex max-w-[220px] items-center gap-1.5 truncate">
          {isQuick && (
            <span
              className="inline-flex shrink-0 items-center rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
              title="Consulta rápida (resuelta in-situ)"
            >
              ⚡ Rápida
            </span>
          )}
          <span className="truncate">{row.original.title}</span>
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    meta: { sortKey: "status" },
    cell: ({ row }) => <IncidentStateBadge status={row.original.status} />,
  },
  {
    accessorKey: "priority",
    header: "Prioridad",
    meta: { sortKey: "priority" },
    cell: ({ row }) => (
      <Badge variant="outline" className={PRIORITY_COLORS[row.original.priority] ?? ""}>
        {INCIDENT_PRIORITY_LABELS[row.original.priority as IncidentPriority] ?? row.original.priority}
      </Badge>
    ),
  },
  {
    accessorKey: "assignedUserName",
    header: "Asignado",
    cell: ({ row }) => (
      <AssigneeQuickPicker
        incidentId={row.original.id}
        currentUserId={row.original.assignedUserId}
        currentUserName={row.original.assignedUserName}
        variant="compact"
        stopPropagation
      />
    ),
  },
  {
    accessorKey: "stateChangedAt",
    header: "Antigüedad",
    meta: { sortKey: "stateChangedAt" },
    cell: ({ row }) => (
      <AgingBadge
        stateChangedAt={row.original.stateChangedAt}
        createdAt={row.original.createdAt}
        status={row.original.status}
        resolvedAt={row.original.resolvedAt}
        slaPausedMs={row.original.slaPausedMs}
      />
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Creado",
    meta: { sortKey: "createdAt" },
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
];
