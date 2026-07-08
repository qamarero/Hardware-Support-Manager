"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { Inbox, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchBar } from "@/components/shared/search-bar";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { ConversationList } from "./conversation-list";
import { ConversationDetail } from "./conversation-detail";
import { ImportConversationDialog } from "./import-conversation-dialog";
import { fetchIntercomInbox, dismissInboxItem, recoverDiscardedInboxItem } from "@/server/actions/intercom-inbox";
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

  // Selección múltiple para descarte en bloque (solo en la pestaña Pendientes).
  const selectable = params.status === "pendiente";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearSel = () => setSelected(new Set());

  // Al cambiar de pestaña / página / búsqueda, las filas cambian: limpiar selección.
  useEffect(() => {
    setSelected(new Set());
  }, [params.status, params.page, search]);

  const allVisibleIds = useMemo(() => data.data.map((i) => i.id), [data.data]);
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(allVisibleIds));

  const bulkDismissM = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      for (const id of ids) await dismissInboxItem({ inboxItemId: id });
      return ids;
    },
    onSuccess: (ids) => {
      toast.success(`${ids.length} conversación(es) descartada(s)`, {
        action: {
          label: "Deshacer",
          onClick: async () => {
            for (const id of ids) await recoverDiscardedInboxItem(id);
            refetch();
            toast.success("Descarte deshecho");
          },
        },
      });
      if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      setSelected(new Set());
      refetch();
    },
    onError: () => toast.error("Error al descartar en bloque"),
  });

  const handleConvert = () => {
    refetch();
    setSelectedId(null);
  };

  const handleDismiss = () => {
    refetch();
    setSelectedId(null);
  };

  const handleImported = async (inboxItemId: string, _alreadyExisted: boolean, status: string) => {
    // Mostrar SIEMPRE la conversación importada, exista o no: nos movemos a la
    // pestaña donde vive (una ya existente puede estar en Convertida/Descartada,
    // no en Pendientes) para que aparezca en la lista y quede seleccionada.
    if (params.status !== status) {
      await setParams({ status, page: 1 });
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
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-[0_2px_4px_0_rgba(13,13,18,0.04)]">
          {selectable && data.data.length > 0 && (
            <div className="flex items-center gap-2 border-b px-3 py-2 min-h-[44px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Seleccionar todas las conversaciones"
              />
              {selected.size > 0 ? (
                <>
                  <span className="text-xs font-medium">
                    {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => bulkDismissM.mutate()}
                      disabled={bulkDismissM.isPending}
                    >
                      {bulkDismissM.isPending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                      )}
                      Descartar ({selected.size})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={clearSel}
                      disabled={bulkDismissM.isPending}
                    >
                      Limpiar
                    </Button>
                  </div>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Seleccionar para descartar en bloque
                </span>
              )}
            </div>
          )}
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
                selectable={selectable}
                selectedIds={selected}
                onToggleSelect={toggleSel}
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
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-[0_2px_4px_0_rgba(13,13,18,0.04)]">
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
