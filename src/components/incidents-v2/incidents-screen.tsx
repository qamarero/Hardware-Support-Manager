"use client";

import { Fragment, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2, Ticket, MessageSquare } from "lucide-react";
import { fetchIncidents, fetchUsersForSelect } from "@/server/actions/incidents";
import { IncidentStatusBadge, PriorityPill, SlaBar, Avatar } from "@/components/proto/badges";
import { ConversationPopup } from "@/components/proto/conversation-popup";
import { IncidentDetailDrawer } from "./incident-detail-drawer";
import { IncidentFormDrawer } from "./incident-form-drawer";
import { RmaWizard } from "@/components/incidents/rma-wizard";
import { INCIDENT_STATUS_LABELS, type IncidentStatus } from "@/lib/constants/incidents";
import { extractConversationId } from "@/lib/intercom/sync";
import { intercomConversationUrl } from "@/lib/utils/intercom-url";
import { incidentMissingFields } from "@/lib/utils/incident-completeness";
import { formatRelativeTime } from "@/lib/utils/date-format";
import type { IncidentRow } from "@/server/queries/incidents";

/** Conversación de Intercom asociada (de la URL o del id de escalación). */
function conversationIdOf(i: IncidentRow): string | null {
  return extractConversationId(i.intercomUrl ?? "") ?? i.intercomEscalationId ?? null;
}

const STATUS_ORDER: IncidentStatus[] = [
  "nuevo", "en_triaje", "en_gestion", "esperando_cliente", "esperando_proveedor", "esperando_pieza", "resuelto", "cerrado",
];

/** Estados terminales: la incidencia ya no requiere gestión activa. */
const CLOSED_STATUSES = new Set<IncidentStatus>(["resuelto", "cerrado", "cancelado"]);
const isClosed = (s: IncidentStatus) => CLOSED_STATUSES.has(s);

export function IncidentsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rmaFor, setRmaFor] = useState<IncidentRow | null>(null);
  const [chatFor, setChatFor] = useState<IncidentRow | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"updatedAt" | "priority" | "sla">("updatedAt");

  // Traemos un lote grande y filtramos/ordenamos en cliente (herramienta interna).
  const { data, isLoading } = useQuery({
    queryKey: ["incidents-v2"],
    queryFn: () => fetchIncidents({ page: 1, pageSize: 500, sortBy: "updatedAt", sortOrder: "desc" }),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
  });

  const all: IncidentRow[] = useMemo(() => data?.data ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of STATUS_ORDER) c[s] = all.filter((i) => i.status === s).length;
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    let arr = all.slice();
    if (status !== "all") arr = arr.filter((i) => i.status === status);
    if (priority !== "all") arr = arr.filter((i) => i.priority === priority);
    if (assignee !== "all") arr = arr.filter((i) => i.assignedUserId === assignee);
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((i) =>
        i.incidentNumber.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        (i.deviceModel ?? "").toLowerCase().includes(q) ||
        (i.deviceSerialNumber ?? "").toLowerCase().includes(q)
      );
    }
    const prioOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
    arr.sort((a, b) => {
      // En "Todas", agrupamos abiertas arriba y cerradas/resueltas abajo.
      if (status === "all") {
        const ga = isClosed(a.status) ? 1 : 0;
        const gb = isClosed(b.status) ? 1 : 0;
        if (ga !== gb) return ga - gb;
      }
      if (sortKey === "priority") return (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9);
      // updatedAt y sla → por updatedAt desc (sla aproximado)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return arr;
  }, [all, status, priority, assignee, query, sortKey]);

  // Índice de la primera incidencia cerrada/resuelta: ahí va el divisor visual.
  const firstClosedIdx = useMemo(
    () => (status === "all" ? filtered.findIndex((i) => isClosed(i.status)) : -1),
    [filtered, status]
  );
  const showDivider = firstClosedIdx > 0; // hay al menos una abierta encima

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Incidencias</h1>
        <p>Tickets de soporte hardware</p>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="search" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={14} />
          <input placeholder="Buscar por ID, título, modelo, serie…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto" }} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="all">Toda prioridad</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select className="select" style={{ width: "auto" }} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">Todos los técnicos</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="select" style={{ width: "auto" }} value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)}>
          <option value="updatedAt">Ord: + recientes</option>
          <option value="priority">Ord: prioridad</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> Nueva
        </button>
      </div>

      {/* Chips de estado */}
      <div className="filterbar">
        <button className={`chip ${status === "all" ? "is-active" : ""}`} onClick={() => setStatus("all")}>
          Todas <span className="chip__count">{counts.all}</span>
        </button>
        {STATUS_ORDER.filter((s) => counts[s] > 0 || ["nuevo", "en_gestion", "esperando_pieza"].includes(s)).map((s) => (
          <button key={s} className={`chip ${status === s ? "is-active" : ""}`} onClick={() => setStatus(s)}>
            {INCIDENT_STATUS_LABELS[s]} <span className="chip__count">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Tabla densa */}
      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="card empty">
          <Ticket size={28} color="var(--gray-400)" />
          <h4>Sin resultados</h4>
          <div className="text-sm">Ajusta los filtros o crea una nueva incidencia.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table--dense">
            <thead>
              <tr>
                <th>ID</th>
                <th>Incidencia</th>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Asignado</th>
                <th>Prioridad</th>
                <th>SLA</th>
                <th>Estado</th>
                <th>Actualizada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i, idx) => (
                <Fragment key={i.id}>
                {showDivider && idx === firstClosedIdx && (
                  <tr className="row-divider" aria-hidden>
                    <td colSpan={9} style={{ padding: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px 6px",
                          color: "var(--gray-500)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Cerradas y resueltas
                        </span>
                        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        <span style={{ fontSize: 11, fontWeight: 600 }}>
                          {filtered.length - firstClosedIdx}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  onClick={() => setSelectedId(i.id)}
                  style={isClosed(i.status) ? { opacity: 0.6 } : undefined}
                >
                  <td className="id-cell">{i.incidentNumber}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="fw-600">{i.title}</span>
                      {incidentMissingFields(i).length > 0 && (
                        <span className="badge badge--amber" style={{ fontSize: 10 }} title={`Falta: ${incidentMissingFields(i).join(", ")}`}>Incompleta</span>
                      )}
                      {conversationIdOf(i) && (
                        <button
                          className="icon-btn"
                          title="Ver conversación de Intercom"
                          aria-label="Ver conversación de Intercom"
                          onClick={(e) => { e.stopPropagation(); setChatFor(i); }}
                          style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "var(--orange-50)", color: "var(--primary)", cursor: "pointer" }}
                        >
                          <MessageSquare size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="text-sm">{i.clientCompanyName ?? i.clientName ?? "—"}</td>
                  <td className="text-sm">{i.contactName ?? "—"}</td>
                  <td>
                    {i.assignedUserName ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={i.assignedUserName} size="sm" />
                        <span className="text-sm">{i.assignedUserName.split(" ")[0]}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td><PriorityPill priority={i.priority} /></td>
                  <td><SlaBar incident={i} /></td>
                  <td><IncidentStatusBadge status={i.status} /></td>
                  <td className="text-sm muted">{formatRelativeTime(i.updatedAt)}</td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
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
      <IncidentFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => setSelectedId(id)}
        users={users}
      />
      {rmaFor && (
        <RmaWizard open={!!rmaFor} onOpenChange={(o) => !o && setRmaFor(null)} incident={rmaFor} />
      )}
      {chatFor && (
        <ConversationPopup
          conversationId={conversationIdOf(chatFor)}
          title={chatFor.incidentNumber}
          subtitle={chatFor.clientCompanyName ?? chatFor.clientName ?? chatFor.title}
          intercomUrl={intercomConversationUrl(conversationIdOf(chatFor))}
          onClose={() => setChatFor(null)}
        />
      )}
    </div>
  );
}
