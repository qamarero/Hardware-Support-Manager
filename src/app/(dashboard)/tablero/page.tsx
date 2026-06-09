import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";
import { getIncidents } from "@/server/queries/incidents";
import { getRmas } from "@/server/queries/rmas";
import { OPEN_INCIDENT_STATUSES, OPEN_RMA_STATUSES } from "@/lib/constants/statuses";
import { TableroContent } from "@/components/tablero/tablero-content";

export const metadata: Metadata = {
  title: "Tablero",
};

export const dynamic = "force-dynamic";

export default async function TableroPage() {
  // Traemos los activos (open) de ambas entidades para el tablero.
  const [incidentsResult, rmasResult] = await Promise.all([
    getIncidents({
      page: 1,
      pageSize: 200,
      filters: { status: [...OPEN_INCIDENT_STATUSES, "resuelto"] },
    }),
    getRmas({
      page: 1,
      pageSize: 200,
      filters: { status: [...OPEN_RMA_STATUSES] },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tablero</h1>
          <p className="text-sm text-muted-foreground">
            Arrastra las notas para cambiar de estado. Color por urgencia de SLA.
          </p>
        </div>
      </div>
      <TableroContent incidents={incidentsResult.data} rmas={rmasResult.data} />
    </div>
  );
}
