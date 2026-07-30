"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MessageSquare, Eye, ChevronRight, ChevronDown } from "lucide-react";
import { Drawer } from "@/components/proto/drawer";
import { IncidentStatusBadge, RmaStatusBadge, PriorityPill } from "@/components/proto/badges";
import { CopyId } from "@/components/proto/copy-id";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { fetchIncidents } from "@/server/actions/incidents";
import { fetchRmas } from "@/server/actions/rmas";
import { addComment } from "@/server/actions/notes";
import type { IncidentRow } from "@/server/queries/incidents";
import type { RmaRow } from "@/server/queries/rmas";
import { CLOSED_INCIDENT_STATUSES, CLOSED_RMA_STATUSES } from "@/lib/constants/statuses";
import { formatDateTime } from "@/lib/utils/date-format";

const CLOSED_INC = new Set<string>(CLOSED_INCIDENT_STATUSES);
const CLOSED_RMA = new Set<string>(CLOSED_RMA_STATUSES);

type Tab = "incidencias" | "rmas";
type PriorityFilter = "" | "blocking" | "operational";
type Selected =
  | { type: "incident"; row: IncidentRow }
  | { type: "rma"; row: RmaRow }
  | null;

/** Orden por fecha de creación, de más reciente a más antigua. */
function newestFirst<T extends { createdAt: Date | string }>(a: T, b: T): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/** Prioridad binaria: crítica/alta bloquean la operativa del cliente. */
function isBlocking(priority: string): boolean {
  return priority === "critica" || priority === "alta";
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="ds-overline" style={{ marginBottom: 2 }}>{label}</div>
      <div className="text-sm">{value || <span className="muted">—</span>}</div>
    </div>
  );
}

function device(row: { deviceBrand?: string | null; deviceModel?: string | null; deviceType?: string | null }): string {
  const main = [row.deviceBrand, row.deviceModel].filter(Boolean).join(" ");
  return [main, row.deviceType].filter(Boolean).join(" · ") || "—";
}

/** Cabecera de sección: punto de color + rótulo + contador. */
function SectionLabel({ tone, children, count }: { tone: "active" | "closed"; children: React.ReactNode; count: number }) {
  return (
    <>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          flex: "0 0 auto",
          background: tone === "active" ? "var(--green-500)" : "var(--gray-400)",
        }}
      />
      <span className="ds-overline">{children}</span>
      <span className="chip__count">{count}</span>
    </>
  );
}

function IncidentTable({ rows, onSelect }: { rows: IncidentRow[]; onSelect: (r: IncidentRow) => void }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Nº</th><th>Título</th><th>Prioridad</th><th>Estado</th><th>Cliente</th><th>Creada</th></tr></thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
              <td className="id-cell" onClick={(e) => e.stopPropagation()}><CopyId value={i.incidentNumber} /></td>
              <td className="text-sm">{i.title || "—"}</td>
              <td><PriorityPill priority={i.priority} /></td>
              <td><IncidentStatusBadge status={i.status} /></td>
              <td className="text-sm">{i.clientName ?? "—"}</td>
              <td className="text-sm muted">{formatDateTime(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RmaTable({ rows, onSelect }: { rows: RmaRow[]; onSelect: (r: RmaRow) => void }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Nº</th><th>Proveedor</th><th>Estado</th><th>Cliente</th><th>Creado</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onSelect(r)} style={{ cursor: "pointer" }}>
              <td className="id-cell" onClick={(e) => e.stopPropagation()}><CopyId value={r.rmaNumber} /></td>
              <td className="text-sm">{r.providerName ?? "—"}</td>
              <td><RmaStatusBadge status={r.status} /></td>
              <td className="text-sm">{r.clientName ?? "—"}</td>
              <td className="text-sm muted">{formatDateTime(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const bandStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const bandBtnStyle: React.CSSProperties = {
  ...bandStyle,
  background: "none",
  border: "none",
  padding: "2px 0",
  cursor: "pointer",
  color: "var(--gray-500)",
};

export function ConsultaScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("incidencias");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("");
  const [provider, setProvider] = useState("");
  const [showClosedInc, setShowClosedInc] = useState(false);
  const [showClosedRma, setShowClosedRma] = useState(false);
  const [selected, setSelected] = useState<Selected>(null);
  const [comment, setComment] = useState("");

  const { data: incidents, isLoading: loadingInc } = useQuery({
    queryKey: ["consulta-incidents"],
    queryFn: () => fetchIncidents({ page: 1, pageSize: 300 }),
  });
  const { data: rmas, isLoading: loadingRma } = useQuery({
    queryKey: ["consulta-rmas"],
    queryFn: () => fetchRmas({ page: 1, pageSize: 300 }),
  });

  const commentM = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no selection");
      return addComment({ entityType: selected.type, entityId: selected.row.id, body: comment.trim() });
    },
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Comentario añadido");
      setComment("");
      if (selected) qc.invalidateQueries({ queryKey: ["event-logs", selected.type, selected.row.id] });
    },
    onError: () => toast.error("No se pudo añadir el comentario"),
  });

  const selectIncident = (row: IncidentRow) => { setSelected({ type: "incident", row }); setComment(""); };
  const selectRma = (row: RmaRow) => { setSelected({ type: "rma", row }); setComment(""); };

  const q = query.trim().toLowerCase();

  // ── Incidencias: filtro + orden + split activas/cerradas ──
  const incFiltered = (incidents?.data ?? [])
    .filter((i) => {
      if (priority === "blocking" && !isBlocking(i.priority)) return false;
      if (priority === "operational" && isBlocking(i.priority)) return false;
      if (!q) return true;
      return [i.incidentNumber, i.title, i.clientName, i.deviceSerialNumber]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    })
    .sort(newestFirst);
  const incActive = incFiltered.filter((i) => !CLOSED_INC.has(i.status));
  const incClosed = incFiltered.filter((i) => CLOSED_INC.has(i.status));
  const incFiltersOn = !!q || priority !== "";

  // ── RMA: filtro + orden + split activas/cerradas ──
  const rmaFiltered = (rmas?.data ?? [])
    .filter((r) => {
      if (provider && r.providerName !== provider) return false;
      if (!q) return true;
      return [r.rmaNumber, r.providerName, r.clientName, r.deviceSerialNumber]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    })
    .sort(newestFirst);
  const rmaActive = rmaFiltered.filter((r) => !CLOSED_RMA.has(r.status));
  const rmaClosed = rmaFiltered.filter((r) => CLOSED_RMA.has(r.status));
  const rmaFiltersOn = !!q || provider !== "";

  const providerOptions = Array.from(
    new Set((rmas?.data ?? []).map((r) => r.providerName).filter((n): n is string => !!n)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const closeDrawer = () => { setSelected(null); setComment(""); };

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: 8 }}><Eye size={20} /> Consulta</h1>
        <p>Visibilidad de incidencias y RMA. Solo lectura — puedes dejar comentarios en la timeline.</p>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div className="seg" role="group">
          <button type="button" className={`btn btn--sm ${tab === "incidencias" ? "btn--primary" : "btn--outline"}`} onClick={() => setTab("incidencias")}>
            Incidencias {incidents ? `(${incidents.data.length})` : ""}
          </button>
          <button type="button" className={`btn btn--sm ${tab === "rmas" ? "btn--primary" : "btn--outline"}`} onClick={() => setTab("rmas")}>
            RMA {rmas ? `(${rmas.data.length})` : ""}
          </button>
        </div>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar por nº, título, cliente, serie…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === "incidencias" ? (
          <select className="select" style={{ maxWidth: 190 }} value={priority} onChange={(e) => setPriority(e.target.value as PriorityFilter)}>
            <option value="">Toda prioridad</option>
            <option value="blocking">No puede operar</option>
            <option value="operational">Puede operar</option>
          </select>
        ) : (
          <select className="select" style={{ maxWidth: 220 }} value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {providerOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {tab === "incidencias" ? (
        loadingInc ? (
          <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
        ) : (
          <div className="stack" style={{ gap: 18 }}>
            {/* Activas */}
            <div className="stack" style={{ gap: 8 }}>
              <div style={bandStyle}><SectionLabel tone="active" count={incActive.length}>Activas</SectionLabel></div>
              {incActive.length === 0 ? (
                <div className="card empty">
                  <h4>Sin incidencias activas</h4>
                  <div className="text-sm muted">{incFiltersOn ? "Ninguna con esos filtros." : "No hay incidencias abiertas ahora mismo."}</div>
                </div>
              ) : (
                <IncidentTable rows={incActive} onSelect={selectIncident} />
              )}
            </div>

            {/* Cerradas y resueltas (plegable) */}
            {incClosed.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <button type="button" style={bandBtnStyle} onClick={() => setShowClosedInc((v) => !v)}>
                  {showClosedInc ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <SectionLabel tone="closed" count={incClosed.length}>Cerradas y resueltas</SectionLabel>
                </button>
                {showClosedInc && (
                  <div style={{ opacity: 0.72 }}><IncidentTable rows={incClosed} onSelect={selectIncident} /></div>
                )}
              </div>
            )}
          </div>
        )
      ) : loadingRma ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          {/* Activas */}
          <div className="stack" style={{ gap: 8 }}>
            <div style={bandStyle}><SectionLabel tone="active" count={rmaActive.length}>Activos</SectionLabel></div>
            {rmaActive.length === 0 ? (
              <div className="card empty">
                <h4>Sin RMA activos</h4>
                <div className="text-sm muted">{rmaFiltersOn ? "Ninguno con esos filtros." : "No hay RMA abiertos ahora mismo."}</div>
              </div>
            ) : (
              <RmaTable rows={rmaActive} onSelect={selectRma} />
            )}
          </div>

          {/* Cerrados (plegable) */}
          {rmaClosed.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <button type="button" style={bandBtnStyle} onClick={() => setShowClosedRma((v) => !v)}>
                {showClosedRma ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <SectionLabel tone="closed" count={rmaClosed.length}>Cerrados y entregados</SectionLabel>
              </button>
              {showClosedRma && (
                <div style={{ opacity: 0.72 }}><RmaTable rows={rmaClosed} onSelect={selectRma} /></div>
              )}
            </div>
          )}
        </div>
      )}

      <Drawer
        open={!!selected}
        onClose={closeDrawer}
        title={
          selected?.type === "incident"
            ? `Incidencia ${selected.row.incidentNumber}`
            : selected?.type === "rma"
              ? `RMA ${selected.row.rmaNumber}`
              : ""
        }
        subtitle="Solo lectura · puedes dejar un comentario"
        width={660}
      >
        {selected && (
          <div className="stack" style={{ gap: 18 }}>
            {selected.type === "incident" ? (
              <>
                <div className="row row--2">
                  <Info label="Estado" value={<IncidentStatusBadge status={selected.row.status} />} />
                  <Info label="Prioridad" value={<PriorityPill priority={selected.row.priority} />} />
                  <Info label="Cliente" value={selected.row.clientName} />
                  <Info label="Asignado" value={selected.row.assignedUserName} />
                  <Info label="Dispositivo" value={device(selected.row)} />
                  <Info label="Nº de serie" value={selected.row.deviceSerialNumber} />
                  <Info label="Creada" value={formatDateTime(selected.row.createdAt)} />
                </div>
                {selected.row.title && <Info label="Título" value={selected.row.title} />}
                {selected.row.description && (
                  <Info label="Descripción" value={<span style={{ whiteSpace: "pre-wrap" }}>{selected.row.description}</span>} />
                )}
              </>
            ) : (
              <>
                <div className="row row--2">
                  <Info label="Estado" value={<RmaStatusBadge status={selected.row.status} />} />
                  <Info label="Proveedor" value={selected.row.providerName} />
                  <Info label="Cliente" value={selected.row.clientName} />
                  <Info label="Incidencia" value={selected.row.incidentNumber} />
                  <Info label="Dispositivo" value={device(selected.row)} />
                  <Info label="Nº de serie" value={selected.row.deviceSerialNumber} />
                  <Info label="Creado" value={formatDateTime(selected.row.createdAt)} />
                </div>
                {selected.row.notes && (
                  <Info label="Notas" value={<span style={{ whiteSpace: "pre-wrap" }}>{selected.row.notes}</span>} />
                )}
              </>
            )}

            {/* Comentario interno */}
            <div className="card card--pad stack" style={{ gap: 8 }}>
              <div className="ds-overline">Dejar un comentario</div>
              <textarea
                className="textarea"
                rows={3}
                placeholder="Comentario para el equipo (queda en la timeline, interno)…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn--primary btn--sm"
                  disabled={!comment.trim() || commentM.isPending}
                  onClick={() => commentM.mutate()}
                >
                  {commentM.isPending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />} Comentar
                </button>
              </div>
            </div>

            {/* Timeline */}
            <EventLogTimeline entityType={selected.type} entityId={selected.row.id} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
