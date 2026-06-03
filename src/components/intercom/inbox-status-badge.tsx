import { Badge } from "@/components/ui/badge";
import { INTERCOM_INBOX_STATUS_LABELS, type IntercomInboxStatus } from "@/lib/constants/intercom";

const STATUS_COLORS: Record<IntercomInboxStatus, string> = {
  pendiente: "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:bg-amber-500/25 dark:text-amber-300",
  convertida: "bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:bg-green-500/25 dark:text-green-300",
  descartada: "bg-gray-500/15 text-gray-700 hover:bg-gray-500/15 dark:bg-gray-500/25 dark:text-gray-300",
};

export function InboxStatusBadge({ status }: { status: IntercomInboxStatus }) {
  const isActive = status === "pendiente";
  return (
    <Badge variant="outline" className={STATUS_COLORS[status]}>
      {isActive ? (
        <span className="relative inline-flex w-1.5 h-1.5 mr-1.5">
          <span className="absolute inset-0 rounded-full bg-current animate-ping opacity-30" />
          <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-current" />
        </span>
      ) : (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      )}
      {INTERCOM_INBOX_STATUS_LABELS[status]}
    </Badge>
  );
}
