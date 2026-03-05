"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { getUserColumns } from "@/components/users/user-columns";
import { useTableSearchParams } from "@/hooks/use-table-search-params";
import { fetchUsers, deleteUser } from "@/server/actions/users";
import type { UserRow } from "@/server/queries/users";
import type { PaginatedResult, SortOrder } from "@/types";

interface UserListProps {
  initialData: PaginatedResult<UserRow>;
}

export function UserList({ initialData }: UserListProps) {
  const queryClient = useQueryClient();
  const { page, pageSize, search, sortBy, sortOrder, setSearch, setSorting, setPage } =
    useTableSearchParams("createdAt");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryKey = useMemo(
    () => ["users", { page, pageSize, search, sortBy, sortOrder }],
    [page, pageSize, search, sortBy, sortOrder]
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      fetchUsers({
        page,
        pageSize,
        search: search || undefined,
        sortBy,
        sortOrder: sortOrder as SortOrder,
      }),
    initialData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Usuario eliminado correctamente");
        queryClient.invalidateQueries({ queryKey: ["users"] });
      } else {
        toast.error(result.error);
      }
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Error al eliminar el usuario");
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
      getUserColumns({
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
        searchPlaceholder="Buscar usuarios por nombre o email..."
        isLoading={isLoading}
        onPageChange={setPage}
        onSearchChange={setSearch}
      />

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Eliminar usuario"
        description="¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer."
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
