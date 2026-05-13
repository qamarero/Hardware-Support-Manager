"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { Inbox, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchBar } from "@/components/shared/search-bar";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { SubmissionList } from "./submission-list";
import { SubmissionDetail } from "./submission-detail";
import { fetchSupportSubmissions } from "@/server/actions/support-submissions";
import type { SupportSubmissionRow } from "@/server/queries/support-submissions";
import type { PaginatedResult } from "@/types";
import type { SupportSubmissionStatus } from "@/lib/constants/support-submissions";

interface SubmissionsInboxProps {
  initialData: PaginatedResult<SupportSubmissionRow>;
}

export function SubmissionsInbox({ initialData }: SubmissionsInboxProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { inputValue, setInputValue, debouncedValue: search } = useDebouncedSearch();

  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      status: parseAsString.withDefault("pendiente"),
    },
    { shallow: false }
  );

  const { data: queryData, isLoading, refetch } = useQuery({
    queryKey: ["support-submissions", { page: params.page, status: params.status, search }],
    queryFn: () =>
      fetchSupportSubmissions({
        page: params.page,
        pageSize: 20,
        search: search || undefined,
        status: params.status as SupportSubmissionStatus,
      }),
    placeholderData: keepPreviousData,
  });

  const data = queryData ?? initialData;
  const selectedItem = data.data.find((item) => item.id === selectedId) ?? null;

  const handleConvert = () => {
    refetch();
    setSelectedId(null);
  };

  const handleDismiss = () => {
    refetch();
    setSelectedId(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={params.status}
          onValueChange={(v) => setParams({ status: v, page: 1 })}
        >
          <TabsList>
            <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
            <TabsTrigger value="convertida">Convertidas</TabsTrigger>
            <TabsTrigger value="descartada">Descartadas</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchBar
          value={inputValue}
          onChange={setInputValue}
          placeholder="Buscar por cliente, asunto, emisor..."
        />
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_5fr]">
        {/* Left: List */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {isLoading && !queryData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data.data.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground"
                style={{ animation: "fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
              >
                <Inbox className="h-8 w-8" />
                <p className="text-sm">Sin sumisiones</p>
              </div>
            ) : (
              <SubmissionList
                items={data.data}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </ScrollArea>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t px-3 py-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={params.page <= 1}
                onClick={() => setParams({ page: params.page - 1 })}
              >
                ← Anterior
              </button>
              <span className="text-xs text-muted-foreground">
                {params.page} / {data.totalPages}
              </span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={params.page >= data.totalPages}
                onClick={() => setParams({ page: params.page + 1 })}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>

        {/* Right: Detail */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {selectedItem ? (
            <SubmissionDetail
              key={selectedItem.id}
              item={selectedItem}
              onConvert={handleConvert}
              onDismiss={handleDismiss}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground"
              style={{ animation: "fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
            >
              <Inbox className="h-10 w-10" />
              <p className="text-sm">Selecciona una sumisión para ver el detalle</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
