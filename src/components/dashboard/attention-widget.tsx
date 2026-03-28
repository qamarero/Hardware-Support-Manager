"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Building2,
  Package,
  AlertOctagon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AlertSummary, AlertItem } from "@/server/queries/alerts";

interface AttentionWidgetProps {
  initialData: AlertSummary;
}

const PRIORITY_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const PRIORITY_COLORS: Record<string, string> = {
  critica: "bg-red-500/15 text-red-700 dark:text-red-400",
  alta: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  baja: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
};

function daysBadgeClass(days: number): string {
  if (days > 7) return "bg-red-500/15 text-red-700 dark:text-red-400";
  if (days > 3) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

interface SectionProps {
  title: string;
  icon: React.ElementType;
  items: AlertItem[];
}

function AlertSection({ title, icon: Icon, items }: SectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 pb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <Badge variant="outline" className="ml-auto text-xs px-1.5 py-0">
          {items.length}
        </Badge>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
        >
          <Link
            href={item.entityUrl}
            className="shrink-0 font-mono text-xs font-medium text-primary hover:underline"
          >
            {item.number}
          </Link>
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
            {item.title ?? item.status}
          </span>
          <Badge
            className={cn(
              "shrink-0 text-xs px-1.5 py-0 border-0",
              daysBadgeClass(item.daysSinceChange)
            )}
          >
            {item.daysSinceChange}d
          </Badge>
          {item.priority != null && (
            <Badge
              className={cn(
                "shrink-0 text-xs px-1.5 py-0 border-0",
                PRIORITY_COLORS[item.priority] ?? "bg-muted text-muted-foreground"
              )}
            >
              {PRIORITY_LABELS[item.priority] ?? item.priority}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

export function AttentionWidget({ initialData }: AttentionWidgetProps) {
  const { items, counts, totalCount } = initialData;

  const staleIncidents = items.filter((i) => i.type === "incident_stale");
  const stuckRmas = items.filter((i) => i.type === "rma_stuck_provider");
  const warehouseRmas = items.filter((i) => i.type === "rma_warehouse");
  const slaWarnings = items.filter((i) => i.type === "sla_warning");

  const hasAny =
    counts.staleIncidents > 0 ||
    counts.stuckRmas > 0 ||
    counts.warehouseRmas > 0 ||
    counts.slaWarnings > 0;

  if (!hasAny) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-900/50">
      <CardHeader className="flex flex-row items-center gap-2 pb-2 pt-4 px-4">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <CardTitle className="text-sm font-semibold">
          Requiere Atención
        </CardTitle>
        <Badge className="ml-auto shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 text-xs">
          {totalCount}
        </Badge>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AlertSection
            title="Incidencias estancadas"
            icon={Clock}
            items={staleIncidents}
          />
          <AlertSection
            title="RMAs en proveedor"
            icon={Building2}
            items={stuckRmas}
          />
          <AlertSection
            title="Dispositivos en almacén"
            icon={Package}
            items={warehouseRmas}
          />
          <AlertSection
            title="SLA en riesgo"
            icon={AlertOctagon}
            items={slaWarnings}
          />
        </div>
      </CardContent>
    </Card>
  );
}
