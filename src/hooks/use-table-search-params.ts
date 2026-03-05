"use client";

import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";

export function useTableSearchParams(defaultSortBy: string = "createdAt") {
  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(10),
      search: parseAsString.withDefault(""),
      sortBy: parseAsString.withDefault(defaultSortBy),
      sortOrder: parseAsString.withDefault("desc"),
    },
    { shallow: false }
  );

  function setSearch(value: string) {
    setParams({ search: value, page: 1 });
  }

  function setSorting(sortBy: string, sortOrder: "asc" | "desc") {
    setParams({ sortBy, sortOrder, page: 1 });
  }

  function setPage(page: number) {
    setParams({ page });
  }

  function setPageSize(pageSize: number) {
    setParams({ pageSize, page: 1 });
  }

  return {
    ...params,
    setSearch,
    setSorting,
    setPage,
    setPageSize,
  };
}
