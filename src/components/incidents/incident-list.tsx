"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTableSearchParams } from "@/hooks/use-table-search-params";
import { DataTable } from "@/components/shared/data-table";
import { incidentColumns } from "./incident-columns";
import { fetchIncidents } from "@/server/actions/incidents";
import type { PaginatedResult } from "@/types";
import type { IncidentRow } from "@/server/queries/incidents";
import type { SortOrder } from "@/types";

interface IncidentListProps {
  initialData: PaginatedResult<IncidentRow>;
}

export function IncidentList({ initialData }: IncidentListProps) {
  const { page, pageSize, search, sortBy, sortOrder, setSearch, setPage } =
    useTableSearchParams("createdAt");

  const { data: queryData, isLoading } = useQuery({
    queryKey: ["incidents", page, pageSize, search, sortBy, sortOrder],
    queryFn: () =>
      fetchIncidents({ page, pageSize, search, sortBy, sortOrder: sortOrder as SortOrder }),
    initialData,
    placeholderData: keepPreviousData,
  });

  const data = queryData ?? initialData;

  return (
    <DataTable
      columns={incidentColumns}
      data={data.data}
      totalCount={data.totalCount}
      page={data.page}
      pageSize={data.pageSize}
      totalPages={data.totalPages}
      searchValue={search}
      searchPlaceholder="Buscar incidencia..."
      isLoading={isLoading}
      onPageChange={setPage}
      onSearchChange={setSearch}
    />
  );
}
