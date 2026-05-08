"use client";

import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { AgingBadge } from "@/components/shared/aging-badge";
import { RmaStateBadge } from "@/components/shared/state-badge";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RmaStatus } from "@/lib/constants/rmas";
import { CLOSED_RMA_STATUSES } from "@/lib/constants/statuses";

export interface RmaKanbanCardData {
  id: string;
  rmaNumber: string;
  href: string;
  status: RmaStatus;
  providerName?: string | null;
  deviceInfo?: string | null;
  stateChangedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

interface RmaKanbanCardProps {
  data: RmaKanbanCardData;
  isDragOverlay?: boolean;
}

export const RmaKanbanCard = memo(function RmaKanbanCard({ data, isDragOverlay }: RmaKanbanCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: data.id,
    data: { rmaId: data.id, status: data.status },
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
        <CardContent className="space-y-2 p-3">
          {/* Header: RMA number + status badge */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-primary">{data.rmaNumber}</span>
            <RmaStateBadge status={data.status} />
          </div>

          {/* Device info */}
          {data.deviceInfo && (
            <p className="line-clamp-2 text-xs leading-tight">{data.deviceInfo}</p>
          )}

          {/* Bottom row: aging + provider */}
          <div className="flex items-center justify-between gap-2">
            <AgingBadge
              stateChangedAt={data.stateChangedAt}
              createdAt={data.createdAt}
              status={data.status}
              closedStatuses={CLOSED_RMA_STATUSES}
              pausedStatuses={[]}
            />
            {data.providerName && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="max-w-[80px] truncate">{data.providerName}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
