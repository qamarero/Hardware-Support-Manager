"use client";

import { useQuery } from "@tanstack/react-query";
import { useTableSearchParams } from "@/hooks/use-table-search-params";
import { useFilterParams } from "@/hooks/use-filter-params";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { DataTable } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterBar } from "@/components/shared/filter-bar";
import { rmaColumns } from "./rma-columns";
import { fetchRmas } from "@/server/actions/rmas";
import { RMA_FILTERS } from "@/lib/constants/filter-options";
import type { PaginatedResult } from "@/types";
import type { RmaRow } from "@/server/queries/rmas";
import type { SortOrder } from "@/types";

interface RmaListProps {
  initialData: PaginatedResult<RmaRow>;
}

export function RmaList({ initialData }: RmaListProps) {
  const { page, pageSize, sortBy, sortOrder, setPage, setPageSize, setSorting } =
    useTableSearchParams("stateChangedAt");
  const { inputValue, setInputValue, debouncedValue: search } = useDebouncedSearch();
  const { params: filterParams, filterValues, setFilter, clearFilters, activeFilterCount } =
    useFilterParams(RMA_FILTERS);

  const { data: queryData, isLoading } = useQuery({
    queryKey: ["rmas", { page, pageSize, search, sortBy, sortOrder, filters: filterValues }],
    queryFn: () =>
      fetchRmas({
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
      columns={rmaColumns}
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
            placeholder="Buscar RMA..."
          />
          <FilterBar
            filters={RMA_FILTERS}
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
