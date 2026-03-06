import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIncidents } from "@/server/queries/incidents";
import { IncidentPageContent } from "@/components/incidents/incident-page-content";
import type { SortOrder } from "@/types";

export const metadata: Metadata = {
  title: "Incidencias",
};

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;
  const search = typeof params.search === "string" ? params.search : undefined;
  const sortBy = typeof params.sortBy === "string" ? params.sortBy : "createdAt";
  const sortOrder = (typeof params.sortOrder === "string" ? params.sortOrder : "desc") as SortOrder;

  const initialData = await getIncidents({
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Incidencias</h1>
            <p className="text-sm text-muted-foreground">
              Gestión de tickets de soporte técnico
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/incidents/new">
            <Plus className="h-4 w-4 mr-1" />
            Nueva Incidencia
          </Link>
        </Button>
      </div>
      <IncidentPageContent initialData={initialData} />
    </div>
  );
}
