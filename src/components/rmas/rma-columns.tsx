"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { RmaRow } from "@/server/queries/rmas";
import { RmaStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import { formatDate } from "@/lib/utils/date-format";

export const rmaColumns: ColumnDef<RmaRow, unknown>[] = [
  {
    accessorKey: "rmaNumber",
    header: "N\u00famero",
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
    accessorKey: "status",
    header: "Estado",
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
    cell: ({ row }) => row.original.clientName ?? "-",
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
    header: "Antig\u00fcedad",
    cell: ({ row }) => <AgingBadge stateChangedAt={row.original.stateChangedAt} />,
  },
  {
    accessorKey: "createdAt",
    header: "Creado",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
];
