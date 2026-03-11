"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTableSearchParams } from "@/hooks/use-table-search-params";
import { DataTable } from "@/components/shared/data-table";
import { rmaColumns } from "./rma-columns";
import { fetchRmas } from "@/server/actions/rmas";
import type { PaginatedResult } from "@/types";
import type { RmaRow } from "@/server/queries/rmas";
import type { SortOrder } from "@/types";

interface RmaListProps {
  initialData: PaginatedResult<RmaRow>;
}

export function RmaList({ initialData }: RmaListProps) {
  const { page, pageSize, search, sortBy, sortOrder, setSearch, setPage } =
    useTableSearchParams("createdAt");

  const { data: queryData, isLoading } = useQuery({
    queryKey: ["rmas", page, pageSize, search, sortBy, sortOrder],
    queryFn: () =>
      fetchRmas({ page, pageSize, search, sortBy, sortOrder: sortOrder as SortOrder }),
    initialData,
    placeholderData: keepPreviousData,
  });

  const data = queryData ?? initialData;

  return (
    <DataTable
      columns={rmaColumns}
      data={data.data}
      totalCount={data.totalCount}
      page={data.page}
      pageSize={data.pageSize}
      totalPages={data.totalPages}
      searchValue={search}
      searchPlaceholder="Buscar RMA..."
      isLoading={isLoading}
      onPageChange={setPage}
      onSearchChange={setSearch}
    />
  );
}
