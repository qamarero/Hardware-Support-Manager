"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Plus,
  Pencil,
  Paperclip,
  Trash2,
  Loader2,
  StickyNote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchEventLogs } from "@/server/actions/event-logs";
import { formatRelativeTime } from "@/lib/utils/date-format";
import { INCIDENT_STATUS_LABELS } from "@/lib/constants/incidents";
import { RMA_STATUS_LABELS } from "@/lib/constants/rmas";
import type { EntityType } from "@/lib/constants/attachments";

interface EventLogTimelineProps {
  entityType: EntityType;
  entityId: string;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Creado",
  updated: "Actualizado",
  transition: "Transición de estado",
  attachment_added: "Adjunto añadido",
  attachment_removed: "Adjunto eliminado",
  note: "Nota",
};

const ACTION_ICONS: Record<string, typeof Plus> = {
  created: Plus,
  updated: Pencil,
  transition: ArrowRight,
  attachment_added: Paperclip,
  attachment_removed: Trash2,
  note: StickyNote,
};

function getStatusLabel(status: string | null, entityType: EntityType): string {
  if (!status) return "";
  const labels =
    entityType === "incident" ? INCIDENT_STATUS_LABELS : RMA_STATUS_LABELS;
  return (labels as Record<string, string>)[status] ?? status;
}

export function EventLogTimeline({
  entityType,
  entityId,
}: EventLogTimelineProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["event-logs", entityType, entityId],
    queryFn: () => fetchEventLogs(entityType, entityId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Historial de Actividad</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin actividad registrada
          </p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/20 via-border to-transparent" />
            {logs.map((log, index) => {
              const Icon = ACTION_ICONS[log.action] ?? Plus;
              const details = log.details as Record<string, string> | null;
              const isFirst = index === 0;
              return (
                <div
                  key={log.id}
                  className="relative flex gap-4 pb-6 last:pb-0"
                  style={{ animation: `slideInLeft 250ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 60}ms both` }}
                >
                  <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isFirst ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${isFirst ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      {log.action === "transition" && log.fromState && log.toState && (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {getStatusLabel(log.fromState, entityType)}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">
                            {getStatusLabel(log.toState, entityType)}
                          </Badge>
                        </div>
                      )}
                      {log.action === "created" && log.toState && (
                        <Badge variant="outline" className="text-xs">
                          {getStatusLabel(log.toState, entityType)}
                        </Badge>
                      )}
                    </div>
                    {details?.comment && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {details.comment}
                      </p>
                    )}
                    {log.action === "note" && details?.body && (
                      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                        {details.body}
                      </p>
                    )}
                    {details?.fileName && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {details.fileName}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.userName ?? "Sistema"} &middot;{" "}
                      {formatRelativeTime(log.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
