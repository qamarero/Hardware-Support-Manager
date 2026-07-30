"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MessageSquare, Eye } from "lucide-react";
import { Drawer } from "@/components/proto/drawer";
import { IncidentStatusBadge, RmaStatusBadge, PriorityPill } from "@/components/proto/badges";
import { CopyId } from "@/components/proto/copy-id";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { fetchIncidents } from "@/server/actions/incidents";
import { fetchRmas } from "@/server/actions/rmas";
import { addComment } from "@/server/actions/notes";
import type { IncidentRow } from "@/server/queries/incidents";
import type { RmaRow } from "@/server/queries/rmas";
import { formatDateTime } from "@/lib/utils/date-format";

type Tab = "incidencias" | "rmas";
type Selected =
  | { type: "incident"; row: IncidentRow }
  | { type: "rma"; row: RmaRow }
  | null;

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

export function ConsultaScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("incidencias");
  const [query, setQuery] = useState("");
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

  const q = query.trim().toLowerCase();
  const incRows = (incidents?.data ?? []).filter(
    (i) => !q || [i.incidentNumber, i.title, i.clientName, i.deviceSerialNumber].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q)),
  );
  const rmaRows = (rmas?.data ?? []).filter(
    (r) => !q || [r.rmaNumber, r.providerName, r.clientName, r.deviceSerialNumber].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q)),
  );

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
          style={{ maxWidth: 300 }}
          placeholder="Buscar por nº, título, cliente, serie…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {tab === "incidencias" ? (
        loadingInc ? (
          <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
        ) : incRows.length === 0 ? (
          <div className="card empty"><h4>Sin incidencias</h4></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nº</th><th>Título</th><th>Prioridad</th><th>Estado</th><th>Cliente</th><th>Creada</th></tr></thead>
              <tbody>
                {incRows.map((i) => (
                  <tr key={i.id} onClick={() => { setSelected({ type: "incident", row: i }); setComment(""); }} style={{ cursor: "pointer" }}>
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
        )
      ) : loadingRma ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : rmaRows.length === 0 ? (
        <div className="card empty"><h4>Sin RMA</h4></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nº</th><th>Proveedor</th><th>Estado</th><th>Cliente</th><th>Creado</th></tr></thead>
            <tbody>
              {rmaRows.map((r) => (
                <tr key={r.id} onClick={() => { setSelected({ type: "rma", row: r }); setComment(""); }} style={{ cursor: "pointer" }}>
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
