"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, RotateCcw, Clock, Pencil, X } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { Combobox } from "@/components/proto/combobox";
import { ArticleCombobox } from "@/components/proto/article-combobox";
import { CopyId } from "@/components/proto/copy-id";
import { IncidentStatusBadge, PriorityPill, SlaBar, slaProgress } from "@/components/proto/badges";
import { ConversationThread } from "@/components/intercom/conversation-thread";
import { ManualNoteForm } from "@/components/shared/manual-note-form";
import { AttachmentSection } from "@/components/shared/attachment-section";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { ReminderSection } from "@/components/reminders/reminder-section";
import { ClientContext } from "./client-context";
import { fetchIncidentById, updateIncident, transitionIncident, fetchUsersForSelect } from "@/server/actions/incidents";
import { fetchClientsForSelect } from "@/server/actions/clients";
import { createReminder } from "@/server/actions/reminders";

/** ISO para un recordatorio dentro de N días a las 9:00. */
function followUpInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
import { getAvailableTransitions } from "@/lib/state-machines/incident";
import { extractConversationId } from "@/lib/intercom/sync";
import { intercomConversationUrl } from "@/lib/utils/intercom-url";
import { incidentMissingFields } from "@/lib/utils/incident-completeness";
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

  // Edición de datos del caso (título, descripción, cliente, contacto, equipo, SLA).
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", clientId: "", intercomUrl: "",
    contactName: "", articleId: "", deviceType: "", deviceBrand: "", deviceModel: "", deviceSerialNumber: "", slaHours: 0,
  });

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
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "select"],
    queryFn: () => fetchClientsForSelect(),
    enabled: !!incidentId && editing,
  });

  useEffect(() => {
    setTab("detalle");
    setEditing(false);
    setDiagnosis(inc?.diagnosis ?? "");
    setResolution(inc?.resolution ?? "");
  }, [inc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    if (!inc) return;
    setForm({
      title: inc.title ?? "",
      description: inc.description ?? "",
      clientId: inc.clientId ?? "",
      intercomUrl: inc.intercomUrl ?? "",
      contactName: inc.contactName ?? "",
      articleId: inc.articleId ?? "",
      deviceType: inc.deviceType ?? "",
      deviceBrand: inc.deviceBrand ?? "",
      deviceModel: inc.deviceModel ?? "",
      deviceSerialNumber: inc.deviceSerialNumber ?? "",
      slaHours: inc.slaHours ?? 0,
    });
    setEditing(true);
  }

  const saveEdit = () => {
    const patch: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description,
      clientId: form.clientId,
      intercomUrl: form.intercomUrl,
      contactName: form.contactName,
      articleId: form.articleId,
      deviceType: form.deviceType,
      deviceBrand: form.deviceBrand,
      deviceModel: form.deviceModel,
      deviceSerialNumber: form.deviceSerialNumber,
    };
    if (form.slaHours) patch.slaHours = form.slaHours;
    updateM.mutate(patch, { onSuccess: (r) => { if (r.success) setEditing(false); } });
  };

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
    onSuccess: (r, toStatus) => {
      if (!r.success) { toast.error(r.error); return; }
      invalidate();
      // Al pasar a un estado de espera, sugerir un recordatorio de seguimiento.
      if (inc && (PAUSED_INCIDENT_STATES as readonly string[]).includes(toStatus)) {
        toast.success(`Estado: ${INCIDENT_STATUS_LABELS[toStatus as IncidentStatus]}`, {
          action: {
            label: "Recordar seguimiento (+2d)",
            onClick: async () => {
              const res = await createReminder({
                entityType: "incident",
                entityId: inc.id,
                title: `Seguimiento ${inc.incidentNumber}`,
                dueAt: followUpInDays(2),
              });
              if (res.success) {
                toast.success("Recordatorio creado para dentro de 2 días");
                qc.invalidateQueries({ queryKey: ["reminders"] });
              }
            },
          },
        });
      } else {
        toast.success("Estado actualizado");
      }
    },
    onError: () => toast.error("Error al cambiar estado"),
  });

  if (!incidentId) return null;

  const conversationId = inc ? (extractConversationId(inc.intercomUrl ?? "") ?? inc.intercomEscalationId) : null;
  const transitions = inc ? getAvailableTransitions(inc.status as IncidentStatus, "admin") : [];
  const isPaused = inc ? (PAUSED_INCIDENT_STATES as readonly string[]).includes(inc.status) : false;
  const isClosed = inc ? ["resuelto", "cerrado", "cancelado"].includes(inc.status) : false;
  const missing = inc ? incidentMissingFields(inc) : [];

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
            <span className="id-cell"><CopyId value={inc.incidentNumber} /></span>
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
              {/* Toggle editar datos */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
                {editing ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}><X size={14} /> Cancelar</button>
                    <button className="btn btn--primary btn--sm" onClick={saveEdit} disabled={updateM.isPending || !form.title.trim()}>
                      {updateM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                    </button>
                  </div>
                ) : (
                  <button className="btn btn--outline btn--sm" onClick={startEdit}><Pencil size={14} /> Editar datos</button>
                )}
              </div>

              {!editing && missing.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--amber-50)", border: "1px solid var(--warning)", borderRadius: 10, fontSize: 13 }}>
                  <Clock size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
                  <span style={{ flex: 1, color: "var(--amber-900, var(--fg-primary))" }}>
                    Información parcial — falta: <strong>{missing.join(", ")}</strong>
                  </span>
                  <button className="btn btn--secondary btn--sm" onClick={startEdit}>Completar</button>
                </div>
              )}

              {editing ? (
                <div className="stack" style={{ gap: 16 }}>
                  <Field label="Título *">
                    <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </Field>
                  <Field label="Descripción">
                    <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </Field>
                  <div className="row row--2">
                    <Field label="Cliente">
                      <Combobox options={clients} value={form.clientId} onChange={(id) => setForm({ ...form, clientId: id })} placeholder="Buscar cliente…" emptyLabel="Ningún cliente coincide" />
                    </Field>
                    <Field label="URL Intercom" hint="Enlace a la conversación">
                      <input className="input" value={form.intercomUrl} onChange={(e) => setForm({ ...form, intercomUrl: e.target.value })} />
                    </Field>
                  </div>
                  <div className="row row--2">
                    <Field label="Persona de contacto">
                      <input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                    </Field>
                    <Field label="SLA (horas)">
                      <select className="select" value={form.slaHours} onChange={(e) => setForm({ ...form, slaHours: Number(e.target.value) })}>
                        <option value={0}>Según prioridad</option>
                        <option value={24}>24h — Crítica</option>
                        <option value={48}>48h — Alta</option>
                        <option value={72}>72h — Estándar</option>
                        <option value={120}>120h — Baja</option>
                      </select>
                    </Field>
                  </div>
                  <div className="row row--2">
                    <Field label="Equipo afectado" hint="Del catálogo; o añádelo si no está">
                      <ArticleCombobox
                        value={form.articleId}
                        onSelect={(a) => setForm({ ...form, articleId: a?.id ?? "", deviceType: a?.deviceType ?? "", deviceBrand: a?.brand ?? "", deviceModel: a?.model ?? "" })}
                      />
                    </Field>
                    <Field label="Nº de serie"><input className="input mono" value={form.deviceSerialNumber} onChange={(e) => setForm({ ...form, deviceSerialNumber: e.target.value })} /></Field>
                  </div>
                </div>
              ) : (
                <>
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
                    <dt>Intercom</dt>
                    <dd>
                      {intercomConversationUrl(conversationId) ? (
                        <a href={intercomConversationUrl(conversationId)!} target="_blank" rel="noopener noreferrer" className="ds-link">
                          Abrir conversación ↗
                        </a>
                      ) : "—"}
                    </dd>
                    <dt>Persona de contacto</dt><dd>{inc.contactName ?? "—"}</dd>
                    <dt>Abierta</dt><dd>{formatDateTime(inc.createdAt)}</dd>
                    <dt>Última actualización</dt><dd>{formatDateTime(inc.updatedAt)}</dd>
                    <dt>SLA</dt><dd>{inc.slaHours ? `${inc.slaHours}h` : "Según prioridad"} · {slaProgress(inc).label}</dd>
                  </dl>
                </>
              )}

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

              {/* Historial del cliente */}
              {inc.clientId && (
                <ClientContext clientId={inc.clientId} clientName={inc.clientCompanyName ?? inc.clientName} currentIncidentId={inc.id} />
              )}

              {/* Recordatorios / seguimientos */}
              <ReminderSection entityType="incident" entityId={inc.id} defaultTitle={`Seguimiento ${inc.incidentNumber}`} />

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
