"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2, Clock, Ticket, Laptop } from "lucide-react";
import { fetchIncidents, fetchUsersForSelect } from "@/server/actions/incidents";
import { Avatar, slaProgress } from "@/components/proto/badges";
import { IncidentDetailDrawer } from "@/components/incidents-v2/incident-detail-drawer";
import { IncidentFormDrawer } from "@/components/incidents-v2/incident-form-drawer";
import { RmaWizard } from "@/components/incidents/rma-wizard";
import { INCIDENT_STATUS_LABELS, INCIDENT_PRIORITY_LABELS, type IncidentStatus, type IncidentPriority } from "@/lib/constants/incidents";
import { PAUSED_INCIDENT_STATES } from "@/lib/constants/statuses";
import { formatRelativeTime } from "@/lib/utils/date-format";
import type { IncidentRow } from "@/server/queries/incidents";

// Paleta de post-it por prioridad (papel cálido, coherente con Qamarero).
const POSTIT: Record<string, { bg: string; edge: string; ink: string }> = {
  critica: { bg: "#ffd4cc", edge: "#ffb8aa", ink: "#8a1c00" },
  alta: { bg: "#ffe7b3", edge: "#ffd98a", ink: "#7a4e00" },
  media: { bg: "#fff79a", edge: "#fff04d", ink: "#6b5e00" },
  baja: { bg: "#d7f0d2", edge: "#bce4b4", ink: "#1f5a17" },
};

// Rotación pequeña determinista por id (estable entre renders).
function rotFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return (h % 700) / 100 - 3.5; // -3.5° .. +3.5°
}

const COLUMN_ORDER: IncidentStatus[] = [
  "nuevo", "en_triaje", "en_gestion", "esperando_pieza", "esperando_proveedor", "esperando_cliente", "resuelto", "cerrado", "cancelado",
];
const PRIORITY_ORDER: IncidentPriority[] = ["critica", "alta", "media", "baja"];
const CLOSED = ["resuelto", "cerrado", "cancelado"];

type GroupBy = "status" | "priority" | "assignee";

export function CorchoScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rmaFor, setRmaFor] = useState<IncidentRow | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [hideClosed, setHideClosed] = useState(true);
  const [assignee, setAssignee] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["incidents-v2"],
    queryFn: () => fetchIncidents({ page: 1, pageSize: 500, sortBy: "updatedAt", sortOrder: "desc" }),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
  });

  const all: IncidentRow[] = useMemo(() => data?.data ?? [], [data]);

  const visible = useMemo(() => {
    let arr = all.slice();
    if (hideClosed) arr = arr.filter((i) => i.status !== "cerrado" && i.status !== "cancelado");
    if (assignee !== "all") arr = arr.filter((i) => i.assignedUserId === assignee);
    return arr;
  }, [all, hideClosed, assignee]);

  const zones = useMemo(() => {
    if (groupBy === "priority") {
      return PRIORITY_ORDER.map((p) => ({
        key: p, label: INCIDENT_PRIORITY_LABELS[p], paused: false,
        items: visible.filter((i) => i.priority === p),
      })).filter((z) => z.items.length);
    }
    if (groupBy === "assignee") {
      const zonesByTech = users.map((t) => ({
        key: t.id, label: t.name, paused: false,
        items: visible.filter((i) => i.assignedUserId === t.id),
      }));
      const unassigned = { key: "none", label: "Sin asignar", paused: false, items: visible.filter((i) => !i.assignedUserId) };
      return [...zonesByTech, unassigned].filter((z) => z.items.length);
    }
    return COLUMN_ORDER
      .filter((s) => !(hideClosed && (s === "cerrado" || s === "cancelado")))
      .map((s) => ({
        key: s, label: INCIDENT_STATUS_LABELS[s],
        paused: (PAUSED_INCIDENT_STATES as readonly string[]).includes(s),
        items: visible.filter((i) => i.status === s),
      }))
      .filter((z) => z.items.length);
  }, [visible, groupBy, users, hideClosed]);

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Corcho</h1>
        <p>Vista rápida del día · click en una nota para abrirla</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="seg">
          <button className={groupBy === "status" ? "is-active" : ""} onClick={() => setGroupBy("status")}>Por estado</button>
          <button className={groupBy === "priority" ? "is-active" : ""} onClick={() => setGroupBy("priority")}>Por prioridad</button>
          <button className={groupBy === "assignee" ? "is-active" : ""} onClick={() => setGroupBy("assignee")}>Por técnico</button>
        </div>
        <select className="select" style={{ width: "auto" }} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">Todos los técnicos</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button className={`chip ${hideClosed ? "is-active" : ""}`} onClick={() => setHideClosed(!hideClosed)}>
          {hideClosed ? "Ocultando cerradas" : "Mostrando cerradas"}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> Nueva
        </button>
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : (
        <div className="cork">
          {zones.map((zone) => (
            <div key={zone.key} className="cork__zone">
              <div className="cork__zone-label">
                {zone.label}
                <span className="cork__zone-count">{zone.items.length}</span>
                {zone.paused && <Clock size={11} color="rgba(255,255,255,0.7)" />}
              </div>
              <div className="cork__notes">
                {zone.items.map((inc) => (
                  <PostIt key={inc.id} incident={inc} onOpen={() => setSelectedId(inc.id)} />
                ))}
              </div>
            </div>
          ))}
          {!zones.length && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.85)" }}>
              <Ticket size={28} color="rgba(255,255,255,0.7)" />
              <div className="fw-700" style={{ marginTop: 8, fontSize: 15 }}>No hay notas que mostrar</div>
              <div className="text-sm" style={{ opacity: 0.8 }}>Ajusta los filtros o crea una incidencia.</div>
            </div>
          )}
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

function PostIt({ incident, onOpen }: { incident: IncidentRow; onOpen: () => void }) {
  const c = POSTIT[incident.priority] ?? POSTIT.media;
  const rot = rotFor(incident.id);
  const sla = slaProgress(incident);
  const isClosed = CLOSED.includes(incident.status);
  const device = [incident.deviceBrand, incident.deviceModel].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className="postit"
      onClick={onOpen}
      style={{
        ["--rot" as string]: `${rot}deg`,
        background: `linear-gradient(160deg, ${c.bg} 0%, ${c.edge} 100%)`,
        color: c.ink,
      }}
    >
      <span className="postit__pin" aria-hidden="true" />
      {sla.level === "paused" && <span className="postit__flag postit__flag--paused"><Clock size={11} /> En pausa</span>}
      {sla.level === "bad" && !isClosed && <span className="postit__flag postit__flag--late">Fuera de SLA</span>}

      <div className="postit__id">{incident.incidentNumber}</div>
      <div className="postit__title">{incident.title}</div>

      <div className="postit__meta">
        {device && (
          <span className="postit__device">
            <Laptop size={14} /> {device.split(" ").slice(0, 2).join(" ")}
          </span>
        )}
      </div>

      <div className="postit__foot">
        {incident.assignedUserName ? (
          <span className="postit__tech">
            <Avatar name={incident.assignedUserName} size="sm" />
            {incident.assignedUserName.split(" ")[0]}
          </span>
        ) : <span />}
        <span className="postit__date">{formatRelativeTime(incident.updatedAt)}</span>
      </div>
    </button>
  );
}
