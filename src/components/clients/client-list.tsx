"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { getClientColumns } from "@/components/clients/client-columns";
import { useTableSearchParams } from "@/hooks/use-table-search-params";
import { fetchClients, deleteClient } from "@/server/actions/clients";
import type { ClientRow } from "@/server/queries/clients";
import type { PaginatedResult, SortOrder } from "@/types";

interface ClientListProps {
  initialData: PaginatedResult<ClientRow>;
}

export function ClientList({ initialData }: ClientListProps) {
  const queryClient = useQueryClient();
  const { page, pageSize, search, sortBy, sortOrder, setSearch, setSorting, setPage } =
    useTableSearchParams("createdAt");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryKey = useMemo(
    () => ["clients", { page, pageSize, search, sortBy, sortOrder }],
    [page, pageSize, search, sortBy, sortOrder]
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      fetchClients({
        page,
        pageSize,
        search: search || undefined,
        sortBy,
        sortOrder: sortOrder as SortOrder,
      }),
    initialData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Cliente eliminado correctamente");
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      } else {
        toast.error(result.error);
      }
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Error al eliminar el cliente");
      setDeleteId(null);
    },
  });

  const handleDelete = useCallback((id: string) => {
    setDeleteId(id);
  }, []);

  const handleSort = useCallback(
    (newSortBy: string, newSortOrder: SortOrder) => {
      setSorting(newSortBy, newSortOrder);
    },
    [setSorting]
  );

  const columns = useMemo(
    () =>
      getClientColumns({
        onDelete: handleDelete,
        sortBy,
        sortOrder: sortOrder as SortOrder,
        onSort: handleSort,
      }),
    [handleDelete, sortBy, sortOrder, handleSort]
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
        searchPlaceholder="Buscar clientes por nombre, email o empresa..."
        isLoading={isLoading}
        onPageChange={setPage}
        onSearchChange={setSearch}
      />

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Eliminar cliente"
        description="¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer."
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId);
          }
        }}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
