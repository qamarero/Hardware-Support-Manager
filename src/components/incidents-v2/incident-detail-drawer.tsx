"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, RotateCcw, Clock, Pencil, X, MessageSquare } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { Combobox } from "@/components/proto/combobox";
import { ArticleCombobox } from "@/components/proto/article-combobox";
import { CopyId } from "@/components/proto/copy-id";
import { IncidentStatusBadge, PriorityPill, SlaBar, slaProgress } from "@/components/proto/badges";
import { ConversationPopup } from "@/components/proto/conversation-popup";
import { ManualNoteForm } from "@/components/shared/manual-note-form";
import { AttachmentSection } from "@/components/shared/attachment-section";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { ReminderSection } from "@/components/reminders/reminder-section";
import { ClientContext } from "./client-context";
import { useDrawers } from "@/components/shell/drawers-provider";
import { fetchIncidentById, updateIncident, transitionIncident, fetchUsersForSelect, fetchLinkedRmas } from "@/server/actions/incidents";
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
import { INCIDENT_STATUS_LABELS, priorityBucket, type IncidentStatus } from "@/lib/constants/incidents";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import { PAUSED_INCIDENT_STATES } from "@/lib/constants/statuses";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date-format";

/** Estados seleccionables en transición libre (sin en_triaje, legacy). */
const SELECTABLE_STATUSES: IncidentStatus[] = [
  "nuevo", "en_gestion", "esperando_cliente", "esperando_proveedor", "esperando_pieza", "resuelto", "cerrado", "cancelado",
];

interface Props {
  incidentId: string | null;
  onClose: () => void;
  onDeriveRma?: (incidentId: string) => void;
}

export function IncidentDetailDrawer({ incidentId, onClose, onDeriveRma }: Props) {
  const qc = useQueryClient();
  const { openRma } = useDrawers();
  const [tab, setTab] = useState<"detalle" | "timeline" | "adjuntos">("detalle");
  const [diagnosis, setDiagnosis] = useState("");
  const [resolution, setResolution] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  // Edición de datos del caso (título, descripción, cliente, contacto, equipo, SLA).
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", clientId: "", clientName: "", intercomUrl: "",
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
  const { data: clientsRaw = [] } = useQuery({
    queryKey: ["clients", "select"],
    queryFn: () => fetchClientsForSelect(),
    enabled: !!incidentId && editing,
  });
  const clients = useMemo(
    () => clientsRaw.map((c) => ({ id: c.id, name: c.name, hint: c.externalId })),
    [clientsRaw]
  );
  const { data: linkedRmas = [] } = useQuery({
    queryKey: ["linked-rmas", incidentId],
    queryFn: () => fetchLinkedRmas(incidentId!),
    enabled: !!incidentId,
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
      clientName: inc.clientId ? "" : (inc.clientName ?? ""),
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
      clientName: form.clientName,
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
    mutationFn: (vars: { toStatus: string; force?: boolean }) =>
      transitionIncident({ incidentId: incidentId!, toStatus: vars.toStatus, force: vars.force }),
    onSuccess: (r, vars) => {
      const toStatus = vars.toStatus;
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
        onChange={(e) => {
          const v = e.target.value;
          if (v) transitionM.mutate({ toStatus: v, force: !transitions.some((t) => t.to === v) });
        }}
        disabled={transitionM.isPending}
        title="Cambiar a cualquier estado (libre)"
      >
        <option value="">Cambiar estado…</option>
        {SELECTABLE_STATUSES.filter((s) => s !== inc.status).map((s) => (
          <option key={s} value={s}>{INCIDENT_STATUS_LABELS[s]}</option>
        ))}
      </select>
      <div style={{ flex: 1 }} />
      {linkedRmas.length > 0 ? (
        <button className="btn btn--outline btn--sm" onClick={() => openRma(linkedRmas[0].id)}>
          <RotateCcw size={14} /> Ver {linkedRmas[0].rmaNumber}
        </button>
      ) : (
        !isClosed && onDeriveRma && (
          <button className="btn btn--outline btn--sm" onClick={() => onDeriveRma(inc.id)}>
            <RotateCcw size={14} /> Crear RMA
          </button>
        )
      )}
      {!isClosed && (
        <button className="btn btn--secondary btn--sm" onClick={() => transitionM.mutate({ toStatus: "resuelto", force: !transitions.some((t) => t.to === "resuelto") })} disabled={transitionM.isPending}>
          <Check size={14} /> Marcar resuelta
        </button>
      )}
    </>
  ) : null;

  return (
    <Drawer
      open={!!incidentId}
      onClose={onClose}
      title={inc ? (inc.clientCompanyName ?? inc.clientName ?? "Sin cliente asignado") : "Cargando…"}
      subtitle={
        inc ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            {inc.contactName && <><span>{inc.contactName}</span><span aria-hidden>·</span></>}
            <span className="mono"><CopyId value={inc.incidentNumber} /></span>
            <span aria-hidden>·</span>
            <span title={formatDateTime(inc.createdAt)}>abierta {formatRelativeTime(inc.createdAt)}</span>
          </span>
        ) : undefined
      }
      footer={footer}
      width={760}
    >
      {isLoading || !inc ? (
        <div className="flex items-center gap-2 muted" style={{ padding: 24 }}>
          <Loader2 className="animate-spin" size={16} /> Cargando incidencia…
        </div>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {/* Una sola tira: estado, prioridad, SLA y RMA vinculado. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <IncidentStatusBadge status={inc.status} />
            <PriorityPill priority={inc.priority} />
            {isPaused ? (
              <span
                className="badge badge--blue"
                title={`El tiempo en ${INCIDENT_STATUS_LABELS[inc.status as IncidentStatus]} no cuenta para el plazo de resolución`}
              >
                <Clock size={12} /> SLA en pausa{inc.slaHours ? ` · ${inc.slaHours} h` : ""}
              </span>
            ) : (
              <SlaBar incident={inc} />
            )}
            {linkedRmas.map((r) => (
              <button
                key={r.id}
                className="badge badge--outline"
                style={{ cursor: "pointer" }}
                onClick={() => openRma(r.id)}
                title={`Abrir ${r.rmaNumber} · ${RMA_STATUS_LABELS[r.status as RmaStatus] ?? r.status}`}
              >
                <RotateCcw size={11} /> {r.rmaNumber} ↗
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === "detalle" ? "is-active" : ""}`} onClick={() => setTab("detalle")}>Detalle</button>
            <button className={`tab ${tab === "timeline" ? "is-active" : ""}`} onClick={() => setTab("timeline")}>Timeline</button>
            <button className={`tab ${tab === "adjuntos" ? "is-active" : ""}`} onClick={() => setTab("adjuntos")}>Adjuntos</button>
          </div>

          {tab === "detalle" && (
            <div className="stack" style={{ gap: 20 }}>
              {/* En edicion, guardar y cancelar arriba. En lectura el boton de
                  editar vive dentro del grupo de gestion, no flotando aqui. */}
              {editing && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}><X size={14} /> Cancelar</button>
                  <button className="btn btn--primary btn--sm" onClick={saveEdit} disabled={updateM.isPending || !form.title.trim()}>
                    {updateM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                  </button>
                </div>
              )}

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
                      <Combobox
                        options={clients}
                        value={form.clientId}
                        onChange={(id) => setForm({ ...form, clientId: id, clientName: id ? "" : form.clientName })}
                        placeholder="Buscar cliente…"
                        emptyLabel="Ningún cliente coincide — escribe para usarlo como texto"
                        allowFreeText
                        freeText={form.clientName}
                        onFreeText={(t) => setForm({ ...form, clientName: t, clientId: "" })}
                      />
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
                  {/* La frase de la incidencia encabeza su propia descripcion,
                      que es su contexto natural. El local va en la cabecera. */}
                  <div className="grp">
                    <div className="grp__title">El problema</div>
                    <div className="grp__lead">{inc.title}</div>
                    {inc.description && (
                      <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-line" }}>{inc.description}</div>
                    )}
                  </div>

                  {(inc.deviceBrand || inc.deviceModel || inc.deviceSerialNumber) && (
                    <div className="grp">
                      <div className="grp__title">Equipo</div>
                      <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}>
                        <span className="fw-700" style={{ fontSize: 13 }}>
                          {[inc.deviceBrand, inc.deviceModel].filter(Boolean).join(" ") || "Sin especificar"}
                        </span>
                        {inc.deviceType && <span className="badge badge--gray">{inc.deviceType}</span>}
                      </div>
                      {inc.deviceSerialNumber && <div className="text-xs muted mono">{inc.deviceSerialNumber}</div>}
                    </div>
                  )}

                  <div className="grp">
                    <div className="grp__title">Gestión</div>
                    <div className="row row--2">
                      <Field label="Técnico asignado">
                        <select className="select" value={inc.assignedUserId ?? ""} onChange={(e) => updateM.mutate({ assignedUserId: e.target.value })}>
                          <option value="">Sin asignar</option>
                          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Prioridad">
                        <select className="select" value={priorityBucket(inc.priority)} onChange={(e) => updateM.mutate({ priority: e.target.value })}>
                          <option value="critica">Cliente no puede operar</option>
                          <option value="media">Cliente puede operar</option>
                        </select>
                      </Field>
                    </div>

                    {/* Meta en dos lineas de texto en vez de una lista de
                        definicion de seis filas: el local, el contacto y la
                        apertura ya estan en la cabecera. */}
                    <div className="text-xs muted" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {intercomConversationUrl(conversationId) && (
                        <>
                          <a href={intercomConversationUrl(conversationId)!} target="_blank" rel="noopener noreferrer" className="ds-link">
                            Abrir en Intercom ↗
                          </a>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <span title={formatDateTime(inc.updatedAt)}>actualizada {formatRelativeTime(inc.updatedAt)}</span>
                      <span aria-hidden>·</span>
                      <span>SLA {inc.slaHours ? `${inc.slaHours} h` : "según prioridad"} · {slaProgress(inc).label}</span>
                      {inc.clientExternalId && (
                        <>
                          <span aria-hidden>·</span>
                          <span title="ID de cliente (Qamarero)" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            ID <CopyId value={inc.clientExternalId} label={`${inc.clientExternalId.slice(0, 8)}…`} />
                          </span>
                        </>
                      )}
                    </div>
                    <div>
                      <button className="btn btn--outline btn--sm" onClick={startEdit}><Pencil size={14} /> Editar datos</button>
                    </div>
                  </div>

                  {/* Lo que solo se rellena a veces, plegado: antes dos areas de
                      texto vacias ocupaban mas alto que toda la informacion. */}
                  <details className="fold">
                    <summary>Diagnóstico y solución aplicada</summary>
                    <div className="fold__body">
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
                    </div>
                  </details>

                  {/* La nota está en las dos pestañas a propósito: se deja la
                      información desde donde uno esté, sin cambiar de sitio. */}
                  <div className="grp">
                    <div className="grp__title">Añadir nota al historial</div>
                    <ManualNoteForm entityType="incident" entityId={inc.id} intercomConversationId={conversationId} />
                  </div>

                  <details className="fold">
                    <summary>Historial del cliente y recordatorios</summary>
                    <div className="fold__body">
                      {inc.clientId && (
                        <ClientContext clientId={inc.clientId} clientName={inc.clientCompanyName ?? inc.clientName} currentIncidentId={inc.id} />
                      )}
                      <ReminderSection entityType="incident" entityId={inc.id} defaultTitle={`Seguimiento ${inc.incidentNumber}`} />
                      {conversationId && (
                        <button type="button" className="btn btn--outline" style={{ justifyContent: "flex-start", gap: 8 }} onClick={() => setChatOpen(true)}>
                          <MessageSquare size={16} /> Ver conversación de Intercom
                        </button>
                      )}
                    </div>
                  </details>
                </>
              )}
            </div>
          )}

          {tab === "timeline" && (
            <EventLogTimeline
              entityType="incident"
              entityId={inc.id}
              composer={<ManualNoteForm entityType="incident" entityId={inc.id} intercomConversationId={conversationId} />}
            />
          )}

          {tab === "adjuntos" && (
            <div className="stack">
              <AttachmentSection entityType="incident" entityId={inc.id} />
            </div>
          )}

          {conversationId && chatOpen && (
            <ConversationPopup
              conversationId={conversationId}
              title={`Conversación · ${inc.incidentNumber}`}
              intercomUrl={intercomConversationUrl(conversationId)}
              onClose={() => setChatOpen(false)}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
