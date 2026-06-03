"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { DateRangeParams } from "@/hooks/use-dashboard-params";
import {
  fetchOpenIncidents,
  fetchActiveRmas,
  fetchOverdueIncidents,
  type DrilldownIncident,
  type DrilldownRma,
} from "@/server/actions/dashboard-drilldown";
import {
  IncidentDrilldown,
  RmaDrilldown,
  DrilldownSkeleton,
} from "./kpi-drilldown-list";

const COLOR_MAP = {
  blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20",
  green: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20",
  purple: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 ring-1 ring-inset ring-purple-500/20",
  red: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-1 ring-inset ring-red-500/20",
};

type DrilldownType = "openIncidents" | "activeRmas" | "overdue";

interface ExpandableKpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: "blue" | "green" | "amber" | "purple" | "red";
  drilldownType: DrilldownType;
  dateRange: DateRangeParams;
}

const DRILLDOWN_FETCHERS = {
  openIncidents: fetchOpenIncidents,
  activeRmas: fetchActiveRmas,
  overdue: fetchOverdueIncidents,
};

export function ExpandableKpiCard({
  title,
  value,
  icon: Icon,
  color,
  drilldownType,
  dateRange,
}: ExpandableKpiCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-drilldown", drilldownType, dateRange],
    queryFn: () => DRILLDOWN_FETCHERS[drilldownType](dateRange) as Promise<unknown>,
    enabled: isExpanded,
    staleTime: 30_000,
  });

  const isRma = drilldownType === "activeRmas";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200",
        isExpanded
          ? "shadow-lg -translate-y-0.5 ring-2 ring-primary/20"
          : "hover:shadow-[0_8px_30px_rgba(13,13,18,0.10)] hover:-translate-y-0.5 dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-6 pb-3">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${COLOR_MAP[color]}`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-bold leading-none tracking-tight animate-count-up">{value}</p>
            <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {title}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-300",
              isExpanded && "rotate-180"
            )}
            style={{
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      </CardContent>

      {/* Expandable drilldown panel */}
      <div
        className="grid transition-[grid-template-rows] overflow-hidden"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transitionDuration: isExpanded ? "400ms" : "300ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "border-t mx-4 pt-2 pb-3 transition-opacity",
              isExpanded ? "opacity-100 delay-150 duration-200" : "opacity-0 duration-150"
            )}
          >
            {isLoading ? (
              <DrilldownSkeleton />
            ) : isRma ? (
              <RmaDrilldown items={(data as DrilldownRma[] | undefined) ?? []} />
            ) : (
              <IncidentDrilldown items={(data as DrilldownIncident[] | undefined) ?? []} />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
