import { Suspense } from "react";
import type { Metadata } from "next";
import { ClipboardList, Loader2 } from "lucide-react";
import { SubmissionsInbox } from "@/components/submissions/submissions-inbox";
import { getSupportSubmissions } from "@/server/queries/support-submissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bandeja Soporte",
};

async function SubmissionsData() {
  const initialData = await getSupportSubmissions({
    page: 1,
    pageSize: 20,
    status: "pendiente",
  });
  return <SubmissionsInbox initialData={initialData} />;
}

export default function SubmissionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Bandeja Soporte</h1>
          <p className="text-sm text-muted-foreground">
            Sumisiones enviadas por el equipo CX desde el formulario público
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
        <SubmissionsData />
      </Suspense>
    </div>
  );
}
