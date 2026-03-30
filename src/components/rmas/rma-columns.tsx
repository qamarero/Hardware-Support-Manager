"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { RmaRow } from "@/server/queries/rmas";
import { RmaStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import { formatDate } from "@/lib/utils/date-format";
import { RmaPreviewPopover } from "./rma-preview";

export const rmaColumns: ColumnDef<RmaRow, unknown>[] = [
  {
    accessorKey: "rmaNumber",
    header: "Número",
    meta: { sortKey: "rmaNumber" },
    cell: ({ row }) => (
      <Link
        href={`/rmas/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.rmaNumber}
      </Link>
    ),
  },
  {
    id: "preview",
    header: "",
    cell: ({ row }) => <RmaPreviewPopover rma={row.original} />,
  },
  {
    accessorKey: "status",
    header: "Estado",
    meta: { sortKey: "status" },
    cell: ({ row }) => <RmaStateBadge status={row.original.status} />,
  },
  {
    accessorKey: "providerName",
    header: "Proveedor",
    cell: ({ row }) => row.original.providerName ?? "-",
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
    accessorKey: "deviceBrand",
    header: "Marca / Modelo",
    cell: ({ row }) => {
      const parts = [row.original.deviceBrand, row.original.deviceModel].filter(Boolean);
      return parts.length > 0 ? parts.join(" ") : "-";
    },
  },
  {
    accessorKey: "incidentNumber",
    header: "Incidencia",
    cell: ({ row }) => row.original.incidentNumber ?? "-",
  },
  {
    accessorKey: "stateChangedAt",
    header: "Antigüedad",
    meta: { sortKey: "stateChangedAt" },
    cell: ({ row }) => <AgingBadge stateChangedAt={row.original.stateChangedAt} />,
  },
  {
    accessorKey: "createdAt",
    header: "Creado",
    meta: { sortKey: "createdAt" },
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
];
