import { Badge } from "@/components/ui/badge";
import {
  SUPPORT_SUBMISSION_STATUS_LABELS,
  type SupportSubmissionStatus,
} from "@/lib/constants/support-submissions";

const COLORS: Record<SupportSubmissionStatus, string> = {
  pendiente: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300",
  convertida: "bg-green-500/15 text-green-700 dark:bg-green-500/25 dark:text-green-300",
  descartada: "bg-muted text-muted-foreground",
};

export function SubmissionStatusBadge({ status }: { status: SupportSubmissionStatus }) {
  return (
    <Badge variant="outline" className={COLORS[status]}>
      {SUPPORT_SUBMISSION_STATUS_LABELS[status]}
    </Badge>
  );
}
