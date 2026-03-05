"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatDate } from "@/lib/utils";
import type { ProviderRow } from "@/server/queries/providers";
import type { SortOrder } from "@/types";

interface GetProviderColumnsParams {
  onDelete: (id: string) => void;
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (sortBy: string, sortOrder: SortOrder) => void;
}

export function getProviderColumns({
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}: GetProviderColumnsParams): ColumnDef<ProviderRow, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <DataTableColumnHeader
          title="Nombre"
          sortKey="name"
          currentSortBy={sortBy}
          currentSortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <Link
          href={`/providers/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "email",
      header: () => (
        <DataTableColumnHeader
          title="Email"
          sortKey="email"
          currentSortBy={sortBy}
          currentSortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => row.original.email || "-",
    },
    {
      accessorKey: "phone",
      header: "Telefono",
      cell: ({ row }) => row.original.phone || "-",
    },
    {
      accessorKey: "contactPerson",
      header: () => (
        <DataTableColumnHeader
          title="Persona de contacto"
          sortKey="contactPerson"
          currentSortBy={sortBy}
          currentSortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => row.original.contactPerson || "-",
    },
    {
      accessorKey: "website",
      header: "Web",
      cell: ({ row }) =>
        row.original.website ? (
          <a
            href={
              row.original.website.startsWith("http")
                ? row.original.website
                : `https://${row.original.website}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {row.original.website}
          </a>
        ) : (
          "-"
        ),
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <DataTableColumnHeader
          title="Creado"
          sortKey="createdAt"
          currentSortBy={sortBy}
          currentSortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/providers/${row.original.id}`}>Editar</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(row.original.id)}
            >
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
