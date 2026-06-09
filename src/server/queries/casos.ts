import { db } from "@/lib/db";
import { incidents, rmas, clients } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Un "Caso" = una incidencia con su RMA vinculado (si existe).
 * Vista de pipeline unificado incidencia↔RMA (prototipo Qamarero).
 */
export interface CasoRow {
  incidentId: string;
  incidentNumber: string;
  title: string;
  status: string;
  priority: string;
  clientName: string | null;
  createdAt: Date;
  stateChangedAt: Date;
  rma: {
    id: string;
    rmaNumber: string;
    status: string;
  } | null;
}

export type CasoFilter = "activos" | "con_rma" | "sin_rma" | "todos";

const CLOSED = ["resuelto", "cerrado", "cancelado"];

export async function getCasos(filter: CasoFilter = "activos"): Promise<CasoRow[]> {
  // LEFT JOIN incidencia → RMA. Una incidencia puede tener varios RMAs;
  // nos quedamos con el más reciente (orden por createdAt desc + dedupe en JS).
  const rows = await db
    .select({
      incidentId: incidents.id,
      incidentNumber: incidents.incidentNumber,
      title: incidents.title,
      status: incidents.status,
      priority: incidents.priority,
      clientName: incidents.clientName,
      clientCompanyName: clients.name,
      createdAt: incidents.createdAt,
      stateChangedAt: incidents.stateChangedAt,
      rmaId: rmas.id,
      rmaNumber: rmas.rmaNumber,
      rmaStatus: rmas.status,
      rmaCreatedAt: rmas.createdAt,
    })
    .from(incidents)
    .leftJoin(rmas, eq(rmas.incidentId, incidents.id))
    .leftJoin(clients, eq(incidents.clientId, clients.id))
    .orderBy(desc(incidents.createdAt), desc(rmas.createdAt));

  // Agrupar por incidencia, quedándonos con el RMA más reciente.
  const byIncident = new Map<string, CasoRow>();
  for (const r of rows) {
    const existing = byIncident.get(r.incidentId);
    if (!existing) {
      byIncident.set(r.incidentId, {
        incidentId: r.incidentId,
        incidentNumber: r.incidentNumber,
        title: r.title,
        status: r.status,
        priority: r.priority,
        clientName: r.clientCompanyName ?? r.clientName,
        createdAt: r.createdAt,
        stateChangedAt: r.stateChangedAt,
        rma: r.rmaId
          ? { id: r.rmaId, rmaNumber: r.rmaNumber!, status: r.rmaStatus! }
          : null,
      });
    } else if (!existing.rma && r.rmaId) {
      existing.rma = { id: r.rmaId, rmaNumber: r.rmaNumber!, status: r.rmaStatus! };
    }
  }

  let casos = Array.from(byIncident.values());

  switch (filter) {
    case "activos":
      casos = casos.filter((c) => !CLOSED.includes(c.status));
      break;
    case "con_rma":
      casos = casos.filter((c) => c.rma !== null);
      break;
    case "sin_rma":
      casos = casos.filter((c) => c.rma === null);
      break;
    // "todos": sin filtro
  }

  return casos;
}
