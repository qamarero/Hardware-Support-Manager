"use client";

import { formatRelativeTime } from "@/lib/utils/date-format";
import type { SupportSubmissionRow } from "@/server/queries/support-submissions";

const PRIORITY_BORDER: Record<string, string> = {
  baja: "border-l-green-500",
  media: "border-l-blue-500",
  alta: "border-l-orange-500",
  critica: "border-l-red-500",
};

interface SubmissionListProps {
  items: SupportSubmissionRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SubmissionList({ items, selectedId, onSelect }: SubmissionListProps) {
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        const borderColor = PRIORITY_BORDER[item.priority] ?? "border-l-transparent";
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full text-left p-3 border-l-4 transition-colors ${borderColor} ${
                isSelected ? "bg-muted/60" : "hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {item.clientName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {item.title}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                Enviado por {item.submitterName}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
