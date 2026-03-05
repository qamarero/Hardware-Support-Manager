"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";

export interface CanvasStatus {
  id: string;
  label: string;
  color: string;
  count: number;
}

export interface CanvasItem {
  statusId: string;
  node: React.ReactNode;
}

interface CanvasViewProps {
  statuses: CanvasStatus[];
  items: CanvasItem[];
}

export function CanvasView({ statuses, items }: CanvasViewProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const visibleStatuses = statuses.filter((s) => s.count > 0);

  const filteredItems =
    selectedStatuses.length === 0
      ? items
      : items.filter((item) => selectedStatuses.includes(item.statusId));

  function toggleStatus(statusId: string) {
    setSelectedStatuses((prev) =>
      prev.includes(statusId)
        ? prev.filter((s) => s !== statusId)
        : [...prev, statusId]
    );
  }

  function selectAll() {
    setSelectedStatuses([]);
  }

  const isAllActive = selectedStatuses.length === 0;

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectAll}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            isAllActive
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          Todos ({items.length})
        </button>
        {visibleStatuses.map((status) => {
          const isActive = selectedStatuses.includes(status.id);
          return (
            <button
              key={status.id}
              type="button"
              onClick={() => toggleStatus(status.id)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
              style={
                isActive
                  ? {
                      borderColor: status.color,
                      backgroundColor: `${status.color}15`,
                    }
                  : undefined
              }
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              {status.label} ({status.count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-muted-foreground">
          <Inbox className="h-10 w-10" />
          <p className="text-sm">No hay elementos con estos filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item, i) => (
            <div key={i}>{item.node}</div>
          ))}
        </div>
      )}
    </div>
  );
}
