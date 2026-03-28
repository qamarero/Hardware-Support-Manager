"use client";

import { Clock, AlertTriangle, CheckCircle, PauseCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SlaIndicatorProps {
  createdAt: Date | string;
  stateChangedAt: Date | string;
  resolvedAt?: Date | string | null;
  slaHours: number;
  slaPausedMs?: string | number;
  currentStatus?: string;
}

/** States where SLA clock is paused */
const PAUSED_STATES = ["esperando_cliente", "esperando_proveedor"];

export function SlaIndicator({
  createdAt,
  stateChangedAt,
  resolvedAt,
  slaHours,
  slaPausedMs = "0",
  currentStatus,
}: SlaIndicatorProps) {
  const created = new Date(createdAt);
  const now = resolvedAt ? new Date(resolvedAt) : new Date();
  const stateChanged = new Date(stateChangedAt);

  // Calculate accumulated paused time
  let pausedMs = typeof slaPausedMs === "string" ? parseInt(slaPausedMs, 10) : slaPausedMs;
  if (isNaN(pausedMs)) pausedMs = 0;

  // If currently in a paused state, add live pause time
  if (!resolvedAt && currentStatus && PAUSED_STATES.includes(currentStatus)) {
    pausedMs += now.getTime() - stateChanged.getTime();
  }

  const totalElapsedMs = now.getTime() - created.getTime();
  const effectiveElapsedMs = totalElapsedMs - pausedMs; // SLA-counting time only
  const stateElapsedMs = now.getTime() - stateChanged.getTime();
  const slaMs = slaHours * 60 * 60 * 1000;

  const totalHours = Math.round(effectiveElapsedMs / (1000 * 60 * 60) * 10) / 10;
  const stateHours = Math.round(stateElapsedMs / (1000 * 60 * 60) * 10) / 10;
  const pausedHours = Math.round(pausedMs / (1000 * 60 * 60) * 10) / 10;
  const progressPercent = Math.min((effectiveElapsedMs / slaMs) * 100, 100);
  const isOverdue = effectiveElapsedMs > slaMs;
  const isWarning = progressPercent >= 75 && !isOverdue;
  const isResolved = !!resolvedAt;
  const isPaused = !resolvedAt && currentStatus && PAUSED_STATES.includes(currentStatus);

  const barColor = isResolved
    ? "bg-green-500"
    : isPaused
    ? "bg-slate-400"
    : isOverdue
    ? "bg-red-500"
    : isWarning
    ? "bg-amber-500"
    : "bg-primary";

  const StatusIcon = isResolved
    ? CheckCircle
    : isPaused
    ? PauseCircle
    : isOverdue
    ? AlertTriangle
    : Clock;

  const statusText = isResolved
    ? "Resuelta"
    : isPaused
    ? "SLA Pausado"
    : isOverdue
    ? "Fuera de SLA"
    : isWarning
    ? "Próxima al límite"
    : "Dentro de SLA";

  const statusColor = isResolved
    ? "text-green-600 dark:text-green-400"
    : isPaused
    ? "text-slate-600 dark:text-slate-400"
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

        <div className={`grid gap-4 text-xs ${pausedHours > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
          <div>
            <span className="text-muted-foreground">Tiempo neto</span>
            <p className="font-medium">{formatDuration(totalHours)}</p>
          </div>
          {pausedHours > 0 && (
            <div>
              <span className="text-muted-foreground">Tiempo pausado</span>
              <p className="font-medium text-slate-500">{formatDuration(pausedHours)}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">En estado actual</span>
            <p className="font-medium">{formatDuration(stateHours)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
