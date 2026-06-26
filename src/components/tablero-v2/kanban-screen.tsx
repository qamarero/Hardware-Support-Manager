"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Clock, Laptop } from "lucide-react";
import { fetchIncidents, fetchUsersForSelect, transitionIncident } from "@/server/actions/incidents";
import { PriorityPill, Avatar } from "@/components/proto/badges";
import { IncidentDetailDrawer } from "@/components/incidents-v2/incident-detail-drawer";
import { IncidentFormDrawer } from "@/components/incidents-v2/incident-form-drawer";
import { RmaWizard } from "@/components/incidents/rma-wizard";
import { getAvailableTransitions } from "@/lib/state-machines/incident";
import { INCIDENT_STATUS_LABELS, type IncidentStatus } from "@/lib/constants/incidents";
import { PAUSED_INCIDENT_STATES } from "@/lib/constants/statuses";
import type { IncidentRow } from "@/server/queries/incidents";

// Columnas del tablero (estados activos). Cerrado/cancelado quedan fuera del flujo diario.
const COLUMNS: IncidentStatus[] = [
  "nuevo", "en_gestion", "esperando_pieza", "esperando_proveedor", "esperando_cliente", "resuelto",
];

const DOT_COLOR: Record<string, string> = {
  nuevo: "red", en_triaje: "amber", en_gestion: "amber",
  esperando_pieza: "purple", esperando_proveedor: "blue", esperando_cliente: "blue",
  resuelto: "green",
};

export function KanbanScreen() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rmaFor, setRmaFor] = useState<IncidentRow | null>(null);
  const [assignee, setAssignee] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["incidents-v2"],
    queryFn: () => fetchIncidents({ page: 1, pageSize: 500, sortBy: "updatedAt", sortOrder: "desc" }),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
  });

  const all: IncidentRow[] = useMemo(() => data?.data ?? [], [data]);
  const visible = useMemo(
    () => (assignee === "all" ? all : all.filter((i) => i.assignedUserId === assignee)),
    [all, assignee]
  );

  const transitionM = useMutation({
    mutationFn: ({ id, to, force }: { id: string; to: string; force?: boolean }) =>
      transitionIncident({ incidentId: id, toStatus: to, force }),
    onSuccess: (r, vars) => {
      if (!r.success) { toast.error(r.error); return; }
      const paused = (PAUSED_INCIDENT_STATES as readonly string[]).includes(vars.to);
      toast.success(`${INCIDENT_STATUS_LABELS[vars.to as IncidentStatus]}${paused ? " · SLA pausado" : ""}`);
      qc.invalidateQueries({ queryKey: ["incidents-v2"] });
    },
    onError: () => toast.error("Error al cambiar estado"),
  });

  function reset() { setDragId(null); setOverCol(null); }

  function onDrop(toStatus: IncidentStatus) {
    const id = dragId;
    reset();
    if (!id) return;
    const inc = all.find((i) => i.id === id);
    if (!inc || inc.status === toStatus) return;
    // Modelo no lineal: se permite mover a cualquier columna. Si el salto no está
    // en el flujo natural, se fuerza (force) para que el servidor no lo rechace.
    const natural = getAvailableTransitions(inc.status as IncidentStatus, "admin").some((t) => t.to === toStatus);
    transitionM.mutate({ id, to: toStatus, force: !natural });
  }

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Tablero Kanban</h1>
        <p>Arrastra las tarjetas para cambiar de estado</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select className="select" style={{ width: "auto" }} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">Todos los técnicos</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> Nueva
        </button>
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : (
        <div className="kanban">
          {COLUMNS.map((col) => {
            const items = visible.filter((i) => i.status === col);
            const isPaused = (PAUSED_INCIDENT_STATES as readonly string[]).includes(col);
            return (
              <div
                key={col}
                className={`kcol ${overCol === col ? "is-over" : ""} ${isPaused ? "kcol--paused" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col); }}
                onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
                onDrop={() => onDrop(col)}
              >
                <div className="kcol__header">
                  <span style={{ width: 8, height: 8, borderRadius: 50, background: `var(--${DOT_COLOR[col] ?? "gray"}-500)` }} />
                  {INCIDENT_STATUS_LABELS[col]}
                  {isPaused && <Clock size={10} />}
                  <span className="kcol__count">{items.length}</span>
                </div>
                {items.map((i) => (
                  <div
                    key={i.id}
                    className={`kcard ${dragId === i.id ? "is-dragging" : ""}`}
                    draggable
                    onDragStart={() => setDragId(i.id)}
                    onDragEnd={reset}
                    onClick={() => setSelectedId(i.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="kcard__id">{i.incidentNumber}</span>
                      <PriorityPill priority={i.priority} />
                    </div>
                    <div className="kcard__title">{i.title}</div>
                    <div className="kcard__meta">
                      {(i.deviceModel || i.deviceBrand) && (
                        <span className="flex items-center gap-2">
                          <Laptop size={12} /> {[i.deviceBrand, i.deviceModel].filter(Boolean).join(" ").split(" ").slice(0, 2).join(" ")}
                        </span>
                      )}
                      <div className="kcard__meta-right">
                        {i.assignedUserName && <Avatar name={i.assignedUserName} size="sm" />}
                      </div>
                    </div>
                  </div>
                ))}
                {!items.length && <div className="muted text-xs" style={{ padding: "12px 8px", textAlign: "center" }}>—</div>}
              </div>
            );
          })}
        </div>
      )}

      <IncidentDetailDrawer
        incidentId={selectedId}
        onClose={() => setSelectedId(null)}
        onDeriveRma={(id) => {
          const row = all.find((x) => x.id === id) ?? null;
          setSelectedId(null);
          setRmaFor(row);
        }}
      />
      <IncidentFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onCreated={(id) => setSelectedId(id)} users={users} />
      {rmaFor && <RmaWizard open={!!rmaFor} onOpenChange={(o) => !o && setRmaFor(null)} incident={rmaFor} />}
    </div>
  );
}
