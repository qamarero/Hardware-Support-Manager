import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AgingBadge } from "./aging-badge";
import { User, Building2 } from "lucide-react";

interface EntityCardProps {
  number: string;
  href: string;
  title: string;
  priorityLabel?: string;
  priorityColor?: string;
  statusBadge?: React.ReactNode;
  stateChangedAt?: Date | string | null;
  assignedUser?: string | null;
  relatedEntity?: string | null;
  relatedEntityIcon?: "user" | "building";
  slaStatus?: "ok" | "warning" | "overdue";
}

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

export function EntityCard({
  number,
  href,
  title,
  priorityLabel,
  priorityColor,
  statusBadge,
  stateChangedAt,
  assignedUser,
  relatedEntity,
  relatedEntityIcon = "user",
  slaStatus,
}: EntityCardProps) {
  const RelatedIcon = relatedEntityIcon === "building" ? Building2 : User;

  return (
    <Link href={href} className="block group">
      <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-border/50 hover:border-primary/30">
        {/* SLA indicator bar */}
        {slaStatus && (
          <div className={`absolute left-0 top-0 h-full w-1 ${SLA_BAR_COLORS[slaStatus]}`} />
        )}

        <CardContent className={`space-y-2 p-4 ${slaStatus ? "pl-5" : ""}`}>
          {/* Header: Number + Priority */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-primary">{number}</span>
            {priorityLabel && (
              <Badge
                variant="outline"
                className={priorityColor ?? PRIORITY_COLORS[priorityLabel.toLowerCase()] ?? ""}
              >
                {priorityLabel}
              </Badge>
            )}
          </div>

          {/* Status badge */}
          {statusBadge && <div>{statusBadge}</div>}

          {/* Title */}
          <p className="line-clamp-2 text-sm leading-tight">{title}</p>

          {/* Bottom row: Aging + Assigned/Related */}
          <div className="flex items-center justify-between gap-2">
            <AgingBadge stateChangedAt={stateChangedAt} />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {(assignedUser || relatedEntity) && (
                <>
                  <RelatedIcon className="h-3 w-3" />
                  <span className="max-w-[100px] truncate">
                    {assignedUser ?? relatedEntity}
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
