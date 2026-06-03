"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Inbox,
  AlertOctagon,
} from "lucide-react";
import { PageSizeSelector } from "@/components/shared/page-size-selector";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  searchBar?: React.ReactNode;
  sortBy?: string;
  sortOrder?: string;
  onSort?: (sortBy: string, sortOrder: "asc" | "desc") => void;
  columnVisibility?: Record<string, boolean>;
  /** Per-row className computed from the row data — used to highlight
   *  stale rows, priority, etc. without touching the table itself. */
  rowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData>({
  columns,
  data,
  totalCount,
  page,
  pageSize,
  totalPages,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onPageChange,
  onPageSizeChange,
  searchBar,
  sortBy,
  sortOrder,
  onSort,
  columnVisibility,
  rowClassName,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    state: {
      columnVisibility: columnVisibility ?? {},
    },
  });

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  function handleSort(sortKey: string) {
    if (!onSort) return;
    if (sortBy === sortKey) {
      onSort(sortKey, sortOrder === "desc" ? "asc" : "desc");
    } else {
      onSort(sortKey, "desc");
    }
  }

  return (
    <div className="space-y-4">
      {searchBar}

      <div className="rounded-xl border border-border/70 bg-card overflow-x-auto shadow-[0_2px_4px_0_rgba(13,13,18,0.04)]">
        <Table>
          <TableHeader className="bg-muted/50 dark:bg-muted/20">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortKey = (header.column.columnDef.meta as { sortKey?: string } | undefined)?.sortKey;
                  const isActive = sortKey != null && sortBy === sortKey;
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : sortKey && onSort ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground transition-colors duration-150 -ml-2 px-2 py-1 rounded-md hover:bg-muted/50"
                          onClick={() => handleSort(sortKey)}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {isActive ? (
                            sortOrder === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={`skeleton-${i}-${j}`}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <AlertOctagon className="h-8 w-8 text-red-500" />
                    <p className="font-medium text-foreground">
                      {errorMessage || "Error al cargar los datos"}
                    </p>
                    <p className="text-sm">Comprueba tu conexión e inténtalo de nuevo.</p>
                    {onRetry && (
                      <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
                        Reintentar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const extraCls = rowClassName?.(row.original) ?? "";
                return (
                  <TableRow
                    key={row.id}
                    className={`hover:bg-muted/50 transition-colors duration-150 ${extraCls}`.trim()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-0 animate-[fadeInUp_300ms_ease-out_forwards]">
                    <Inbox className="h-8 w-8" />
                    <p>No se encontraron resultados.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-muted-foreground shrink-0">
          {totalCount > 0
            ? `Mostrando ${startItem}-${endItem} de ${totalCount}`
            : "Sin resultados"}
        </p>
        {onPageSizeChange && (
          <PageSizeSelector value={pageSize} onChange={onPageSizeChange} />
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Página <span className="font-bold text-primary">{page}</span> de {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
