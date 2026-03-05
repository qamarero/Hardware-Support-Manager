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
}

const PRIORITY_COLORS: Record<string, string> = {
  baja: "bg-green-100 text-green-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  critica: "bg-red-100 text-red-700",
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
}: EntityCardProps) {
  const RelatedIcon = relatedEntityIcon === "building" ? Building2 : User;

  return (
    <Link href={href} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-2 p-4">
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
