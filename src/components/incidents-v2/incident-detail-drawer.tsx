"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, RotateCcw, Clock, Paperclip } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { IncidentStatusBadge, PriorityPill, SlaBar, slaProgress } from "@/components/proto/badges";
import { ConversationThread } from "@/components/intercom/conversation-thread";
import { ManualNoteForm } from "@/components/shared/manual-note-form";
import { AttachmentSection } from "@/components/shared/attachment-section";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { fetchIncidentById, updateIncident, transitionIncident, fetchUsersForSelect } from "@/server/actions/incidents";
import { getAvailableTransitions } from "@/lib/state-machines/incident";
import { extractConversationId } from "@/lib/intercom/sync";
import { INCIDENT_STATUS_LABELS, type IncidentStatus } from "@/lib/constants/incidents";
import { PAUSED_INCIDENT_STATES } from "@/lib/constants/statuses";
import { formatDateTime } from "@/lib/utils/date-format";

interface Props {
  incidentId: string | null;
  onClose: () => void;
  onDeriveRma?: (incidentId: string) => void;
}

export function IncidentDetailDrawer({ incidentId, onClose, onDeriveRma }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"detalle" | "timeline" | "adjuntos">("detalle");
  const [diagnosis, setDiagnosis] = useState("");
  const [resolution, setResolution] = useState("");

  const { data: inc, isLoading } = useQuery({
    queryKey: ["incident-detail", incidentId],
    queryFn: () => fetchIncidentById(incidentId!),
    enabled: !!incidentId,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
    enabled: !!incidentId,
  });

  useEffect(() => {
    setTab("detalle");
    setDiagnosis(inc?.diagnosis ?? "");
    setResolution(inc?.resolution ?? "");
  }, [inc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["incident-detail", incidentId] });
    qc.invalidateQueries({ queryKey: ["incidents-v2"] });
    qc.invalidateQueries({ queryKey: ["event-logs", "incident", incidentId] });
  };

  const updateM = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateIncident(incidentId!, patch),
    onSuccess: (r) => { if (!r.success) { toast.error(r.error); return; } invalidate(); },
    onError: () => toast.error("Error al guardar"),
  });

  const transitionM = useMutation({
    mutationFn: (toStatus: string) => transitionIncident({ incidentId: incidentId!, toStatus }),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Estado actualizado");
      invalidate();
    },
    onError: () => toast.error("Error al cambiar estado"),
  });

  if (!incidentId) return null;

  const conversationId = inc ? (extractConversationId(inc.intercomUrl ?? "") ?? inc.intercomEscalationId) : null;
  const transitions = inc ? getAvailableTransitions(inc.status as IncidentStatus, "admin") : [];
  const isPaused = inc ? (PAUSED_INCIDENT_STATES as readonly string[]).includes(inc.status) : false;
  const isClosed = inc ? ["resuelto", "cerrado", "cancelado"].includes(inc.status) : false;

  const footer = inc ? (
    <>
      <select
        className="select"
        style={{ width: "auto" }}
        value=""
        onChange={(e) => e.target.value && transitionM.mutate(e.target.value)}
        disabled={transitionM.isPending}
      >
        <option value="">Cambiar estado…</option>
        {transitions.map((t) => (
          <option key={t.to} value={t.to}>{t.label}</option>
        ))}
      </select>
      <div style={{ flex: 1 }} />
      {!isClosed && onDeriveRma && (
        <button className="btn btn--outline btn--sm" onClick={() => onDeriveRma(inc.id)}>
          <RotateCcw size={14} /> Crear RMA
        </button>
      )}
      {!isClosed && (
        <button className="btn btn--secondary btn--sm" onClick={() => transitionM.mutate("resuelto")} disabled={transitionM.isPending}>
          <Check size={14} /> Marcar resuelta
        </button>
      )}
    </>
  ) : null;

  return (
    <Drawer
      open={!!incidentId}
      onClose={onClose}
      title={inc?.title ?? "Cargando…"}
      subtitle={inc ? `${inc.incidentNumber} · ${formatDateTime(inc.createdAt)}` : undefined}
      footer={footer}
      width={760}
    >
      {isLoading || !inc ? (
        <div className="flex items-center gap-2 muted" style={{ padding: 24 }}>
          <Loader2 className="animate-spin" size={16} /> Cargando incidencia…
        </div>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {/* Strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <IncidentStatusBadge status={inc.status} />
            <PriorityPill priority={inc.priority} />
            <SlaBar incident={inc} />
          </div>

          {/* SLA pausado */}
          {isPaused && (
            <div style={{ padding: "10px 14px", background: "var(--blue-50)", border: "1px solid var(--blue-500)", borderRadius: 10, display: "flex", gap: 10, fontSize: 13 }}>
              <Clock size={14} color="var(--blue-500)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ color: "var(--blue-900)" }}>
                <strong>SLA en pausa.</strong> El tiempo en <em>{INCIDENT_STATUS_LABELS[inc.status as IncidentStatus]}</em> no cuenta para el plazo de resolución.
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === "detalle" ? "is-active" : ""}`} onClick={() => setTab("detalle")}>Detalle</button>
            <button className={`tab ${tab === "timeline" ? "is-active" : ""}`} onClick={() => setTab("timeline")}>Timeline</button>
            <button className={`tab ${tab === "adjuntos" ? "is-active" : ""}`} onClick={() => setTab("adjuntos")}>Adjuntos</button>
          </div>

          {tab === "detalle" && (
            <div className="stack" style={{ gap: 20 }}>
              {inc.description && (
                <div>
                  <div className="field__label" style={{ marginBottom: 6 }}>Descripción</div>
                  <div style={{ background: "var(--gray-50)", padding: "12px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-line" }}>
                    {inc.description}
                  </div>
                </div>
              )}

              {(inc.deviceBrand || inc.deviceModel || inc.deviceSerialNumber) && (
                <div>
                  <div className="field__label" style={{ marginBottom: 8 }}>Equipo afectado</div>
                  <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="fw-700" style={{ fontSize: 14 }}>{[inc.deviceBrand, inc.deviceModel].filter(Boolean).join(" ") || "—"}</div>
                      {inc.deviceSerialNumber && <div className="text-xs muted mono" style={{ marginTop: 2 }}>Serie: {inc.deviceSerialNumber}{inc.deviceType ? ` · ${inc.deviceType}` : ""}</div>}
                    </div>
                  </div>
                </div>
              )}

              <div className="row row--2">
                <Field label="Técnico asignado">
                  <select className="select" value={inc.assignedUserId ?? ""} onChange={(e) => updateM.mutate({ assignedUserId: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Prioridad">
                  <select className="select" value={inc.priority} onChange={(e) => updateM.mutate({ priority: e.target.value })}>
                    <option value="critica">Crítica</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </Field>
              </div>

              <dl className="dl">
                <dt>Cliente</dt><dd>{inc.clientCompanyName ?? inc.clientName ?? "—"}</dd>
                <dt>Local</dt><dd>{inc.clientLocationName ?? "—"}</dd>
                <dt>Intercom</dt>
                <dd>
                  {inc.intercomUrl ? (
                    <a href={inc.intercomUrl} target="_blank" rel="noopener noreferrer" className="ds-link">
                      Abrir conversación ↗
                    </a>
                  ) : "—"}
                </dd>
                <dt>Reportador</dt><dd>{inc.contactName ?? "—"}</dd>
                <dt>Abierta</dt><dd>{formatDateTime(inc.createdAt)}</dd>
                <dt>Última actualización</dt><dd>{formatDateTime(inc.updatedAt)}</dd>
                <dt>SLA</dt><dd>{inc.slaHours ? `${inc.slaHours}h` : "Según prioridad"} · {slaProgress(inc).label}</dd>
              </dl>

              <Field label="Diagnóstico">
                <textarea className="textarea" placeholder="Pasos de diagnóstico, hallazgos…" value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  onBlur={() => diagnosis !== (inc.diagnosis ?? "") && updateM.mutate({ diagnosis })} />
              </Field>
              <Field label="Solución aplicada">
                <textarea className="textarea" placeholder="Solución final (rellenar al cerrar)…" value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  onBlur={() => resolution !== (inc.resolution ?? "") && updateM.mutate({ resolution })} />
              </Field>

              {/* Intercom (conservado) */}
              {conversationId && (
                <div className="stack" style={{ gap: 12 }}>
                  <div className="field__label">Conversación Intercom</div>
                  <ConversationThread conversationId={conversationId} />
                </div>
              )}
              <div className="stack" style={{ gap: 8 }}>
                <div className="field__label">Añadir nota</div>
                <ManualNoteForm entityType="incident" entityId={inc.id} intercomConversationId={conversationId} />
              </div>
            </div>
          )}

          {tab === "timeline" && <EventLogTimeline entityType="incident" entityId={inc.id} />}

          {tab === "adjuntos" && (
            <div className="stack">
              <AttachmentSection entityType="incident" entityId={inc.id} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
