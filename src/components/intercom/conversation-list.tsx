"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { InboxStatusBadge } from "./inbox-status-badge";
import { formatRelativeTime } from "@/lib/utils/date-format";
import type { IntercomInboxRow } from "@/server/queries/intercom-inbox";
import type { IntercomInboxStatus } from "@/lib/constants/intercom";

interface ConversationListProps {
  items: IntercomInboxRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  critica: "border-l-red-500",
  alta: "border-l-orange-500",
  media: "border-l-blue-500",
  baja: "border-l-green-500",
};

function detectPriority(subject: string | null): string {
  if (!subject) return "media";
  const lower = subject.toLowerCase();
  if (/no puede trabajar|perdiendo dinero|cr[ií]tico|emergencia/.test(lower)) return "critica";
  if (/urgente|bloqueado|no funciona|sin servicio/.test(lower)) return "alta";
  return "media";
}

export function ConversationList({
  items,
  selectedId,
  onSelect,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: ConversationListProps) {
  return (
    <div className="divide-y divide-border/50">
      {items.map((item, index) => {
        const isSelected = item.id === selectedId;
        const isChecked = selectedIds?.has(item.id) ?? false;
        const priority = detectPriority(item.subject);
        const borderColor = PRIORITY_BORDER[priority] ?? "border-l-blue-500";

        return (
          <div
            key={item.id}
            className={cn(
              "flex items-stretch border-l-2 transition-colors duration-150",
              borderColor,
              isSelected ? "bg-primary/5 border-l-primary" : "hover:bg-muted/50"
            )}
            style={{
              animation: `fadeInUp 200ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(index, 10) * 30}ms both`,
            }}
          >
            {selectable && (
              <span
                className="flex items-center pl-3"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleSelect?.(item.id)}
                  aria-label="Seleccionar conversación"
                />
              </span>
            )}
            <button
              type="button"
              className="min-w-0 flex-1 text-left px-4 py-3"
              onClick={() => onSelect(item.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {item.contactName ?? item.contactEmail ?? "Desconocido"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {item.subject ?? "Sin asunto"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(item.receivedAt)}
                  </span>
                  <InboxStatusBadge status={item.status as IntercomInboxStatus} />
                </div>
              </div>
              {item.convertedIncidentNumber && (
                <p className="mt-1 text-xs font-mono text-primary">
                  → {item.convertedIncidentNumber}
                </p>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
