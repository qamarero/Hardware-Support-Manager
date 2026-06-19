"use client";

import { useQuery } from "@tanstack/react-query";
import { Store, Loader2 } from "lucide-react";
import { fetchClientContext } from "@/server/actions/incidents";
import { IncidentStatusBadge } from "@/components/proto/badges";
import { formatRelativeTime } from "@/lib/utils/date-format";

interface Props {
  clientId: string;
  clientName?: string | null;
  currentIncidentId?: string;
}

/** Historial operativo del cliente, para dar contexto/recurrencia en la ficha. */
export function ClientContext({ clientId, clientName, currentIncidentId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-context", clientId, currentIncidentId],
    queryFn: () => fetchClientContext(clientId, currentIncidentId),
  });

  return (
    <div>
      <div className="field__label" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Store size={13} /> Historial del cliente{clientName ? ` · ${clientName}` : ""}
      </div>
      <div className="card" style={{ padding: 14 }}>
        {isLoading || !data ? (
          <div className="flex items-center gap-2 muted text-sm"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            <div style={{ display: "flex", gap: 18 }}>
              <Stat label="Incidencias" value={data.totalIncidents} />
              <Stat label="Abiertas" value={data.openIncidents} accent={data.openIncidents > 0} />
              <Stat label="RMA activos" value={data.activeRmas} accent={data.activeRmas > 0} />
            </div>
            {data.recentIncidents.length > 0 ? (
              <div className="stack" style={{ gap: 6 }}>
                {data.recentIncidents.map((i) => (
                  <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span className="id-cell" style={{ flexShrink: 0 }}>{i.incidentNumber}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</span>
                    <IncidentStatusBadge status={i.status} />
                    <span className="muted" style={{ flexShrink: 0, fontSize: 11 }}>{formatRelativeTime(i.createdAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted text-xs">Sin otras incidencias de este cliente.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs muted">{label}</div>
      <div className="fw-700 mono" style={{ fontSize: 20, color: accent ? "var(--primary)" : "inherit" }}>{value}</div>
    </div>
  );
}
