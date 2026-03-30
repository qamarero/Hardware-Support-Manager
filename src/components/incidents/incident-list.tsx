"use client";

import { useQuery } from "@tanstack/react-query";
import { useTableSearchParams } from "@/hooks/use-table-search-params";
import { useFilterParams } from "@/hooks/use-filter-params";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { DataTable } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterBar } from "@/components/shared/filter-bar";
import { incidentColumns } from "./incident-columns";
import { fetchIncidents } from "@/server/actions/incidents";
import { INCIDENT_FILTERS } from "@/lib/constants/filter-options";
import type { PaginatedResult } from "@/types";
import type { IncidentRow } from "@/server/queries/incidents";
import type { SortOrder } from "@/types";

interface IncidentListProps {
  initialData: PaginatedResult<IncidentRow>;
}

export function IncidentList({ initialData }: IncidentListProps) {
  const { page, pageSize, sortBy, sortOrder, setPage, setPageSize, setSorting } =
    useTableSearchParams("stateChangedAt");
  const { inputValue, setInputValue, debouncedValue: search } = useDebouncedSearch();
  const { params: filterParams, filterValues, setFilter, clearFilters, activeFilterCount } =
    useFilterParams(INCIDENT_FILTERS);

  const { data: queryData, isLoading } = useQuery({
    queryKey: ["incidents", { page, pageSize, search, sortBy, sortOrder, filters: filterValues }],
    queryFn: () =>
      fetchIncidents({
        page,
        pageSize,
        search: search || undefined,
        sortBy,
        sortOrder: sortOrder as SortOrder,
        filters: filterValues,
      }),
    staleTime: 0,
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
      isLoading={isLoading}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={setSorting}
      searchBar={
        <div className="space-y-3">
          <SearchBar
            value={inputValue}
            onChange={setInputValue}
            placeholder="Buscar incidencia..."
          />
          <FilterBar
            filters={INCIDENT_FILTERS}
            params={filterParams}
            onFilterChange={setFilter}
            onClearFilters={clearFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>
      }
    />
  );
}
