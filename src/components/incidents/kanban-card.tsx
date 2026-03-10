"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AgingBadge } from "@/components/shared/aging-badge";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IncidentStatus } from "@/lib/constants/incidents";

const PRIORITY_COLORS: Record<string, string> = {
  baja: "bg-green-500/15 text-green-700 dark:bg-green-500/25 dark:text-green-300",
  media: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300",
  alta: "bg-orange-500/15 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300",
  critica: "bg-red-500/15 text-red-700 dark:bg-red-500/25 dark:text-red-300",
};

const SLA_BAR_COLORS = {
  ok: "bg-green-500",
  warning: "bg-amber-500",
  overdue: "bg-red-500",
};

export interface KanbanCardData {
  id: string;
  incidentNumber: string;
  href: string;
  title: string;
  status: IncidentStatus;
  priorityLabel?: string;
  statusBadge?: React.ReactNode;
  stateChangedAt?: Date | string | null;
  assignedUser?: string | null;
  clientName?: string | null;
  slaStatus?: "ok" | "warning" | "overdue";
}

interface KanbanCardProps {
  data: KanbanCardData;
  isDragOverlay?: boolean;
}

export function KanbanCard({ data, isDragOverlay }: KanbanCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: data.id,
    data: { incidentId: data.id, status: data.status },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
      onClick={() => {
        if (!isDragging) router.push(data.href);
      }}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        isDragOverlay && "rotate-2 shadow-xl cursor-grabbing"
      )}
    >
      <Card className="relative overflow-hidden border-border/50 hover:border-primary/30 transition-all">
        {data.slaStatus && (
          <div className={`absolute left-0 top-0 h-full w-1 ${SLA_BAR_COLORS[data.slaStatus]}`} />
        )}

        <CardContent className={`space-y-2 p-3 ${data.slaStatus ? "pl-4" : ""}`}>
          {/* Header: Number + Priority */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-primary">{data.incidentNumber}</span>
            {data.priorityLabel && (
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0", PRIORITY_COLORS[data.priorityLabel.toLowerCase()] ?? "")}
              >
                {data.priorityLabel}
              </Badge>
            )}
          </div>

          {/* Title */}
          <p className="line-clamp-2 text-xs leading-tight">{data.title}</p>

          {/* Bottom row */}
          <div className="flex items-center justify-between gap-2">
            <AgingBadge stateChangedAt={data.stateChangedAt} />
            {(data.assignedUser || data.clientName) && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="max-w-[80px] truncate">
                  {data.assignedUser ?? data.clientName}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
