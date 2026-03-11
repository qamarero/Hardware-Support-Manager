"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchProviders, deleteProvider } from "@/server/actions/providers";
import { getProviderColumns } from "@/components/providers/provider-columns";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { useTableSearchParams } from "@/hooks/use-table-search-params";
import type { PaginatedResult, SortOrder } from "@/types";
import type { ProviderRow } from "@/server/queries/providers";

interface ProviderListProps {
  initialData: PaginatedResult<ProviderRow>;
}

export function ProviderList({ initialData }: ProviderListProps) {
  const queryClient = useQueryClient();
  const { page, pageSize, search, sortBy, sortOrder, setSearch, setSorting, setPage } =
    useTableSearchParams("createdAt");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: queryData, isLoading } = useQuery({
    queryKey: ["providers", { page, pageSize, search, sortBy, sortOrder }],
    queryFn: () =>
      fetchProviders({ page, pageSize, search, sortBy, sortOrder: sortOrder as SortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const data = queryData ?? initialData;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Proveedor eliminado correctamente");
        queryClient.invalidateQueries({ queryKey: ["providers"] });
      } else {
        toast.error(result.error);
      }
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Error al eliminar el proveedor");
      setDeleteId(null);
    },
  });

  const columns = useMemo(
    () =>
      getProviderColumns({
        onDelete: (id) => setDeleteId(id),
        sortBy,
        sortOrder: sortOrder as "asc" | "desc",
        onSort: setSorting,
      }),
    [sortBy, sortOrder, setSorting]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data.data}
        totalCount={data.totalCount}
        page={data.page}
        pageSize={data.pageSize}
        totalPages={data.totalPages}
        searchValue={search}
        searchPlaceholder="Buscar proveedores..."
        isLoading={isLoading}
        onPageChange={setPage}
        onSearchChange={setSearch}
      />

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Eliminar proveedor"
        description="Esta accion no se puede deshacer. El proveedor sera eliminado permanentemente."
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId);
        }}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
