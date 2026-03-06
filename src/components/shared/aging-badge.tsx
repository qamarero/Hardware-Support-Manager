import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { calculateAging } from "@/lib/utils/aging";

interface AgingBadgeProps {
  stateChangedAt: Date | string | null | undefined;
  thresholdDays?: number;
}

export function AgingBadge({ stateChangedAt, thresholdDays = 3 }: AgingBadgeProps) {
  const aging = calculateAging(stateChangedAt, thresholdDays);

  if (aging.label === "-") return null;

  let colorClass: string;
  if (aging.days >= thresholdDays) {
    colorClass = "bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:bg-red-500/25 dark:text-red-300";
  } else if (aging.days >= 1) {
    colorClass = "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:bg-amber-500/25 dark:text-amber-300";
  } else {
    colorClass = "bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:bg-green-500/25 dark:text-green-300";
  }

  return (
    <Badge variant="outline" className={`gap-1 ${colorClass}`}>
      <Clock className="h-3 w-3" />
      {aging.label}
    </Badge>
  );
}
