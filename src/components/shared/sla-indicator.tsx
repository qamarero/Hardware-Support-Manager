"use client";

import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SlaIndicatorProps {
  createdAt: Date | string;
  stateChangedAt: Date | string;
  resolvedAt?: Date | string | null;
  slaHours: number;
}

export function SlaIndicator({
  createdAt,
  stateChangedAt,
  resolvedAt,
  slaHours,
}: SlaIndicatorProps) {
  const created = new Date(createdAt);
  const now = resolvedAt ? new Date(resolvedAt) : new Date();
  const stateChanged = new Date(stateChangedAt);

  const totalElapsedMs = now.getTime() - created.getTime();
  const stateElapsedMs = now.getTime() - stateChanged.getTime();
  const slaMs = slaHours * 60 * 60 * 1000;

  const totalHours = Math.round(totalElapsedMs / (1000 * 60 * 60) * 10) / 10;
  const stateHours = Math.round(stateElapsedMs / (1000 * 60 * 60) * 10) / 10;
  const progressPercent = Math.min((totalElapsedMs / slaMs) * 100, 100);
  const isOverdue = totalElapsedMs > slaMs;
  const isWarning = progressPercent >= 75 && !isOverdue;
  const isResolved = !!resolvedAt;

  const barColor = isResolved
    ? "bg-green-500"
    : isOverdue
    ? "bg-red-500"
    : isWarning
    ? "bg-amber-500"
    : "bg-primary";

  const StatusIcon = isResolved
    ? CheckCircle
    : isOverdue
    ? AlertTriangle
    : Clock;

  const statusText = isResolved
    ? "Resuelta"
    : isOverdue
    ? "Fuera de SLA"
    : isWarning
    ? "Próxima al límite"
    : "Dentro de SLA";

  const statusColor = isResolved
    ? "text-green-600 dark:text-green-400"
    : isOverdue
    ? "text-red-600 dark:text-red-400"
    : isWarning
    ? "text-amber-600 dark:text-amber-400"
    : "text-primary";

  function formatDuration(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.round(hours / 24 * 10) / 10;
    return `${days}d`;
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
            <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            SLA: {formatDuration(slaHours)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Tiempo total</span>
            <p className="font-medium">{formatDuration(totalHours)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">En estado actual</span>
            <p className="font-medium">{formatDuration(stateHours)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
