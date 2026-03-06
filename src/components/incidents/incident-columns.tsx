"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { IncidentRow } from "@/server/queries/incidents";
import { IncidentStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import { Badge } from "@/components/ui/badge";
import { INCIDENT_PRIORITY_LABELS, type IncidentPriority } from "@/lib/constants/incidents";
import { formatDate } from "@/lib/utils/date-format";

const PRIORITY_COLORS: Record<string, string> = {
  baja: "bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:bg-green-500/25 dark:text-green-300",
  media: "bg-blue-500/15 text-blue-700 hover:bg-blue-500/15 dark:bg-blue-500/25 dark:text-blue-300",
  alta: "bg-orange-500/15 text-orange-700 hover:bg-orange-500/15 dark:bg-orange-500/25 dark:text-orange-300",
  critica: "bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:bg-red-500/25 dark:text-red-300",
};

export const incidentColumns: ColumnDef<IncidentRow, unknown>[] = [
  {
    accessorKey: "incidentNumber",
    header: "N\u00famero",
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
    accessorKey: "title",
    header: "T\u00edtulo",
    cell: ({ row }) => (
      <span className="max-w-[200px] truncate block">{row.original.title}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <IncidentStateBadge status={row.original.status} />,
  },
  {
    accessorKey: "priority",
    header: "Prioridad",
    cell: ({ row }) => (
      <Badge variant="outline" className={PRIORITY_COLORS[row.original.priority] ?? ""}>
        {INCIDENT_PRIORITY_LABELS[row.original.priority as IncidentPriority] ?? row.original.priority}
      </Badge>
    ),
  },
  {
    accessorKey: "clientName",
    header: "Cliente",
    cell: ({ row }) => row.original.clientName ?? "-",
  },
  {
    accessorKey: "assignedUserName",
    header: "Asignado",
    cell: ({ row }) => row.original.assignedUserName ?? "-",
  },
  {
    accessorKey: "stateChangedAt",
    header: "Antig\u00fcedad",
    cell: ({ row }) => <AgingBadge stateChangedAt={row.original.stateChangedAt} />,
  },
  {
    accessorKey: "createdAt",
    header: "Creado",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
];
