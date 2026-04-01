import { Suspense } from "react";
import type { Metadata } from "next";
import { Inbox, Loader2 } from "lucide-react";
import { IntercomInbox } from "@/components/intercom/intercom-inbox";
import { getIntercomInboxItems } from "@/server/queries/intercom-inbox";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bandeja Intercom",
};

async function InboxData() {
  const initialData = await getIntercomInboxItems({
    page: 1,
    pageSize: 20,
    status: "pendiente",
  });
  return <IntercomInbox initialData={initialData} />;
}

export default function IntercomInboxPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
          <Inbox className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Bandeja Intercom</h1>
          <p className="text-sm text-muted-foreground">
            Conversaciones escaladas desde Intercom pendientes de revisión
          </p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <InboxData />
      </Suspense>
    </div>
  );
}
