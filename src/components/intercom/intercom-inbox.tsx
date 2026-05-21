"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { Inbox, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchBar } from "@/components/shared/search-bar";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { ConversationList } from "./conversation-list";
import { ConversationDetail } from "./conversation-detail";
import { ImportConversationDialog } from "./import-conversation-dialog";
import { fetchIntercomInbox } from "@/server/actions/intercom-inbox";
import type { IntercomInboxRow } from "@/server/queries/intercom-inbox";
import type { PaginatedResult } from "@/types";
import type { IntercomInboxStatus } from "@/lib/constants/intercom";

interface IntercomInboxProps {
  initialData: PaginatedResult<IntercomInboxRow>;
}

export function IntercomInbox({ initialData }: IntercomInboxProps) {
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
    queryKey: ["intercom-inbox", { page: params.page, status: params.status, search }],
    queryFn: () =>
      fetchIntercomInbox({
        page: params.page,
        pageSize: 20,
        search: search || undefined,
        status: params.status as IntercomInboxStatus,
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

  const handleImported = async (inboxItemId: string, alreadyExisted: boolean) => {
    // Tras importar, refrescar la lista. Si ya existía, además mover a su tab.
    if (alreadyExisted) {
      // No sabemos en qué tab está — refresh y dejamos que el técnico lo localice.
      // Como mejora futura podríamos hacer una query para saber su status y cambiar de tab.
    } else {
      // Asegurar que estamos en la tab Pendientes (donde acaba de entrar).
      if (params.status !== "pendiente") {
        await setParams({ status: "pendiente", page: 1 });
      }
    }
    await refetch();
    setSelectedId(inboxItemId);
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBar
            value={inputValue}
            onChange={setInputValue}
            placeholder="Buscar conversación..."
          />
          <ImportConversationDialog onImported={handleImported} />
        </div>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_5fr]">
        {/* Left: Conversation list */}
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
                <p className="text-sm">Sin conversaciones</p>
              </div>
            ) : (
              <ConversationList
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

        {/* Right: Detail pane */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {selectedItem ? (
            <ConversationDetail
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
              <p className="text-sm">Selecciona una conversación para ver el detalle</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
