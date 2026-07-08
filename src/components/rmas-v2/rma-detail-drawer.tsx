"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, Clock, Ticket, Pencil, X, MessageSquare, Printer, ExternalLink } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { RmaStatusBadge } from "@/components/proto/badges";
import { CopyId } from "@/components/proto/copy-id";
import { ProviderRmaProcedure } from "@/components/providers/provider-rma-procedure";
import { RmaShippingDialog } from "./rma-shipping-dialog";
import { RmaProviderEmail } from "./rma-provider-email";
import { AttachmentSection } from "@/components/shared/attachment-section";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { ManualNoteForm } from "@/components/shared/manual-note-form";
import { ConversationPopup } from "@/components/proto/conversation-popup";
import { extractConversationId } from "@/lib/intercom/sync";
import { intercomConversationUrl } from "@/lib/utils/intercom-url";
import { useDrawers } from "@/components/shell/drawers-provider";
import { ReminderSection } from "@/components/reminders/reminder-section";
import { createReminder } from "@/server/actions/reminders";

function rmaFollowUpInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
import { fetchRmaById, updateRma, transitionRma, fetchProvidersForSelect } from "@/server/actions/rmas";
import { getRmaAvailableTransitions } from "@/lib/state-machines/rma";
import { RMA_STATUS_LABELS, RMA_OUTCOME_LABELS, RMA_LOGISTICS_LABELS, RMA_REPAIR_PATH_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import { PAUSED_RMA_STATES } from "@/lib/constants/statuses";
import { formatDateTime } from "@/lib/utils/date-format";

interface Props {
  rmaId: string | null;
  onClose: () => void;
}

// Secuencia principal del flujo RMA (rechazado/cancelado quedan fuera del stepper).
const STAGES: RmaStatus[] = [
  "borrador", "solicitado", "aprobado", "enviado_proveedor", "en_proveedor", "devuelto", "recibido_oficina", "enviado_cliente", "esperando_cliente", "entregado_cliente", "cerrado",
];

// Todos los estados seleccionables en transición libre (incluye rechazado/cancelado).
const SELECTABLE_RMA_STATUSES: RmaStatus[] = [
  "borrador", "solicitado", "aprobado", "enviado_proveedor", "en_proveedor", "devuelto", "recibido_oficina", "enviado_cliente", "esperando_cliente", "entregado_cliente", "rechazado", "cerrado", "cancelado",
];

export function RmaDetailDrawer({ rmaId, onClose }: Props) {
  const qc = useQueryClient();
  const { openIncident } = useDrawers();
  const [tab, setTab] = useState<"detalle" | "timeline" | "adjuntos">("detalle");
  const [providerRma, setProviderRma] = useState("");
  const [trackingOut, setTrackingOut] = useState("");
  const [trackingIn, setTrackingIn] = useState("");
  const [notes, setNotes] = useState("");

  // Captura de resultado obligatoria al cerrar/entregar el RMA.
  const [closingTo, setClosingTo] = useState<string | null>(null);
  const [closingOutcome, setClosingOutcome] = useState("");
  const [closingForce, setClosingForce] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Edición de datos del RMA (equipo, proveedor, contacto).
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    providerId: "", contactName: "", deviceBrand: "", deviceModel: "", deviceSerialNumber: "", deviceType: "",
    outcome: "", logistics: "", repairPath: "",
  });

  const { data: rma, isLoading } = useQuery({
    queryKey: ["rma-detail", rmaId],
    queryFn: () => fetchRmaById(rmaId!),
    enabled: !!rmaId,
  });
  const { data: providers = [] } = useQuery({
    queryKey: ["providers", "select"],
    queryFn: () => fetchProvidersForSelect(),
    enabled: !!rmaId && editing,
  });

  useEffect(() => {
    setTab("detalle");
    setEditing(false);
    setProviderRma(rma?.providerRmaNumber ?? "");
    setTrackingOut(rma?.trackingNumberOutgoing ?? "");
    setTrackingIn(rma?.trackingNumberReturn ?? "");
    setNotes(rma?.notes ?? "");
    setClosingTo(null);
    setClosingOutcome("");
  }, [rma?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    if (!rma) return;
    setForm({
      providerId: rma.providerId ?? "",
      contactName: rma.contactName ?? "",
      deviceBrand: rma.deviceBrand ?? "",
      deviceModel: rma.deviceModel ?? "",
      deviceSerialNumber: rma.deviceSerialNumber ?? "",
      deviceType: rma.deviceType ?? "",
      outcome: rma.outcome ?? "",
      logistics: rma.logistics ?? "",
      repairPath: rma.repairPath ?? "",
    });
    setEditing(true);
  }

  const saveEdit = () => {
    updateM.mutate(
      {
        providerId: form.providerId || undefined,
        contactName: form.contactName,
        deviceBrand: form.deviceBrand,
        deviceModel: form.deviceModel,
        deviceSerialNumber: form.deviceSerialNumber,
        deviceType: form.deviceType,
        outcome: form.outcome,
        logistics: form.logistics,
        repairPath: form.repairPath,
      },
      { onSuccess: (r) => { if (r.success) setEditing(false); } }
    );
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rma-detail", rmaId] });
    qc.invalidateQueries({ queryKey: ["rmas-v2"] });
    qc.invalidateQueries({ queryKey: ["event-logs", "rma", rmaId] });
  };

  const updateM = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateRma(rmaId!, patch),
    onSuccess: (r) => { if (!r.success) { toast.error(r.error); return; } invalidate(); },
    onError: () => toast.error("Error al guardar"),
  });

  const transitionM = useMutation({
    mutationFn: (vars: { toStatus: string; outcome?: string; force?: boolean }) =>
      transitionRma({ rmaId: rmaId!, toStatus: vars.toStatus, ...(vars.outcome ? { outcome: vars.outcome } : {}), ...(vars.force ? { force: true } : {}) }),
    onSuccess: (r, vars) => {
      if (!r.success) { toast.error(r.error); return; }
      setClosingTo(null);
      setClosingOutcome("");
      setClosingForce(false);
      invalidate();
      const toStatus = vars.toStatus;
      // Al enviar el equipo al proveedor, sugerir recordatorio de seguimiento.
      if (rma && (PAUSED_RMA_STATES as readonly string[]).includes(toStatus)) {
        toast.success(`Estado: ${RMA_STATUS_LABELS[toStatus as RmaStatus]}`, {
          action: {
            label: "Recordar seguimiento (+3d)",
            onClick: async () => {
              const res = await createReminder({
                entityType: "rma",
                entityId: rma.id,
                title: `Seguir RMA ${rma.rmaNumber} (proveedor)`,
                dueAt: rmaFollowUpInDays(3),
              });
              if (res.success) {
                toast.success("Recordatorio creado para dentro de 3 días");
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

  if (!rmaId) return null;

  const transitions = rma ? getRmaAvailableTransitions(rma.status as RmaStatus, "admin") : [];
  // Conversación de Intercom heredada de la incidencia al derivar (clientIntercomUrl).
  const conversationId = rma ? extractConversationId(rma.clientIntercomUrl ?? "") : null;
  const isPaused = rma ? (PAUSED_RMA_STATES as readonly string[]).includes(rma.status) : false;
  const currentIdx = rma ? STAGES.indexOf(rma.status as RmaStatus) : -1;
  const nextStage = currentIdx >= 0 && currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;
  const canAdvance = nextStage ? transitions.some((t) => t.to === nextStage) : false;

  // Algunos cierres requieren registrar el resultado antes de confirmar.
  function requestTransition(toStatus: string, force = false) {
    if (toStatus === "rechazado") {
      // El proveedor rechaza: el resultado es evidente, se fija automáticamente.
      transitionM.mutate({ toStatus, outcome: "rechazado", force });
      return;
    }
    const needsOutcome = toStatus === "entregado_cliente" || (toStatus === "cerrado" && !rma?.outcome);
    if (needsOutcome) {
      setClosingForce(force);
      setClosingOutcome(rma?.outcome ?? "");
      setClosingTo(toStatus);
      return;
    }
    transitionM.mutate({ toStatus, force });
  }

  const footer = rma ? (
    closingTo ? (
      <>
        <span className="text-sm fw-700" style={{ whiteSpace: "nowrap" }}>
          Resultado al {RMA_STATUS_LABELS[closingTo as RmaStatus]}:
        </span>
        <select
          className="select"
          style={{ width: "auto" }}
          value={closingOutcome}
          onChange={(e) => setClosingOutcome(e.target.value)}
          autoFocus
        >
          <option value="">Elige resultado…</option>
          {Object.entries(RMA_OUTCOME_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn--ghost btn--sm" onClick={() => { setClosingTo(null); setClosingOutcome(""); setClosingForce(false); }} disabled={transitionM.isPending}>
          Cancelar
        </button>
        <button
          className="btn btn--primary btn--sm"
          disabled={!closingOutcome || transitionM.isPending}
          onClick={() => transitionM.mutate({ toStatus: closingTo, outcome: closingOutcome, force: closingForce })}
        >
          {transitionM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar
        </button>
      </>
    ) : (
      <>
        <select
          className="select"
          style={{ width: "auto" }}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) requestTransition(v, !transitions.some((t) => t.to === v));
          }}
          disabled={transitionM.isPending}
          title="Cambiar a cualquier estado (libre)"
        >
          <option value="">Cambiar estado…</option>
          {SELECTABLE_RMA_STATUSES.filter((s) => s !== rma.status).map((s) => (
            <option key={s} value={s}>{RMA_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        {nextStage && canAdvance && (
          <button className="btn btn--primary btn--sm" onClick={() => requestTransition(nextStage)} disabled={transitionM.isPending}>
            <Check size={14} /> Avanzar a {RMA_STATUS_LABELS[nextStage]}
          </button>
        )}
      </>
    )
  ) : null;

  return (
    <Drawer
      open={!!rmaId}
      onClose={onClose}
      title={rma ? `RMA ${rma.rmaNumber}` : "Cargando…"}
      subtitle={rma ? (rma.providerRmaNumber ? `Nº proveedor ${rma.providerRmaNumber}` : formatDateTime(rma.createdAt)) : undefined}
      footer={footer}
      width={760}
    >
      {isLoading || !rma ? (
        <div className="flex items-center gap-2 muted" style={{ padding: 24 }}>
          <Loader2 className="animate-spin" size={16} /> Cargando RMA…
        </div>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {/* Strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="id-cell"><CopyId value={rma.rmaNumber} /></span>
            <RmaStatusBadge status={rma.status} />
            {rma.incidentNumber && (
              rma.incidentId ? (
                <button
                  type="button"
                  className="badge badge--outline"
                  style={{ cursor: "pointer" }}
                  onClick={() => openIncident(rma.incidentId!)}
                  title="Abrir la incidencia vinculada"
                >
                  <Ticket size={12} /> Incidencia {rma.incidentNumber}
                </button>
              ) : (
                <span className="badge badge--outline">
                  <Ticket size={12} /> Incidencia {rma.incidentNumber}
                </span>
              )
            )}
          </div>

          {isPaused && (
            <div style={{ padding: "10px 14px", background: "var(--blue-50)", border: "1px solid var(--blue-500)", borderRadius: 10, display: "flex", gap: 10, fontSize: 13 }}>
              <Clock size={14} color="var(--blue-500)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ color: "var(--blue-900)" }}>
                <strong>SLA en pausa.</strong> El tiempo en <em>{RMA_STATUS_LABELS[rma.status as RmaStatus]}</em> no cuenta para el plazo (el equipo está en el proveedor).
              </div>
            </div>
          )}

          {/* Estado (no secuencial): píldoras de estados, solo se resalta el actual.
              El flujo RMA no es lineal — reflejamos la situación, no un orden fijo. */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <div className="field__label">Estado</div>
              {isPaused && <span className="badge badge--blue" title="En este estado el SLA está en pausa (fuera de nuestro alcance)">⏸ SLA en pausa</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SELECTABLE_RMA_STATUSES.map((s) => {
                const active = s === rma.status;
                return (
                  <span
                    key={s}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 999, fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      background: active ? "var(--primary)" : "var(--gray-50)",
                      color: active ? "#fff" : "var(--gray-600)",
                      border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                      opacity: active ? 1 : 0.85,
                    }}
                  >
                    {active && <span style={{ width: 6, height: 6, borderRadius: 50, background: "#fff" }} />}
                    {RMA_STATUS_LABELS[s]}
                  </span>
                );
              })}
            </div>
            <div className="text-xs muted" style={{ marginTop: 10 }}>
              Los estados no son secuenciales: marcan la situación actual, no un orden por el que haya que pasar.
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === "detalle" ? "is-active" : ""}`} onClick={() => setTab("detalle")}>Detalle</button>
            <button className={`tab ${tab === "timeline" ? "is-active" : ""}`} onClick={() => setTab("timeline")}>Timeline</button>
            <button className={`tab ${tab === "adjuntos" ? "is-active" : ""}`} onClick={() => setTab("adjuntos")}>Adjuntos</button>
          </div>

          {tab === "detalle" && (
            <div className="stack" style={{ gap: 20 }}>
              {rma.providerId && <ProviderRmaProcedure providerId={rma.providerId} />}
              <div style={{ display: "flex", justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <a
                  href={`/etiqueta/rma/${rma.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--primary btn--sm"
                  title="Imprimir etiqueta física (100×150) u hoja A4 de envío"
                >
                  <Printer size={14} /> Etiqueta
                </a>
                <RmaShippingDialog rma={rma} />
                <RmaProviderEmail rma={rma} />
                {conversationId && (
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => setChatOpen(true)}>
                    <MessageSquare size={14} /> Ver conversación
                  </button>
                )}
              </div>
              {/* Toggle editar datos */}
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: -8 }}>
                {editing ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}><X size={14} /> Cancelar</button>
                    <button className="btn btn--primary btn--sm" onClick={saveEdit} disabled={updateM.isPending}>
                      {updateM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                    </button>
                  </div>
                ) : (
                  <button className="btn btn--outline btn--sm" onClick={startEdit}><Pencil size={14} /> Editar datos</button>
                )}
              </div>

              {editing ? (
                <div className="stack" style={{ gap: 16 }}>
                  <div className="row row--2">
                    <Field label="Proveedor">
                      <select className="select" value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
                        <option value="">Sin proveedor</option>
                        {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Persona de contacto">
                      <input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                    </Field>
                  </div>
                  <div className="row row--3">
                    <Field label="Marca"><input className="input" value={form.deviceBrand} onChange={(e) => setForm({ ...form, deviceBrand: e.target.value })} /></Field>
                    <Field label="Modelo"><input className="input" value={form.deviceModel} onChange={(e) => setForm({ ...form, deviceModel: e.target.value })} /></Field>
                    <Field label="Nº de serie"><input className="input mono" value={form.deviceSerialNumber} onChange={(e) => setForm({ ...form, deviceSerialNumber: e.target.value })} /></Field>
                  </div>
                  <Field label="Tipo de equipo">
                    <input className="input" placeholder="Ej. TPV, impresora, tablet…" value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value })} />
                  </Field>
                  <div className="row row--3">
                    <Field label="Logística">
                      <select className="select" value={form.logistics} onChange={(e) => setForm({ ...form, logistics: e.target.value })}>
                        <option value="">—</option>
                        {Object.entries(RMA_LOGISTICS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Vía de reparación">
                      <select className="select" value={form.repairPath} onChange={(e) => setForm({ ...form, repairPath: e.target.value })}>
                        <option value="">—</option>
                        {Object.entries(RMA_REPAIR_PATH_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Resultado">
                      <select className="select" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
                        <option value="">—</option>
                        {Object.entries(RMA_OUTCOME_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              ) : (
                <>
                  {(rma.deviceBrand || rma.deviceModel || rma.deviceSerialNumber) && (
                    <div>
                      <div className="field__label" style={{ marginBottom: 8 }}>Equipo afectado</div>
                      <div className="card" style={{ padding: 16 }}>
                        <div className="fw-700" style={{ fontSize: 14 }}>{[rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" ") || "—"}</div>
                        {rma.deviceSerialNumber && <div className="text-xs muted mono" style={{ marginTop: 2 }}>Serie: {rma.deviceSerialNumber}{rma.deviceType ? ` · ${rma.deviceType}` : ""}</div>}
                      </div>
                    </div>
                  )}

                  <dl className="dl">
                    <dt>Proveedor</dt><dd>{rma.providerName ?? "—"}</dd>
                    <dt>Cliente</dt><dd>{rma.clientCompanyName ?? rma.clientName ?? "—"}</dd>
                    <dt>Persona de contacto</dt><dd>{rma.contactName ?? "—"}</dd>
                    {conversationId && (
                      <>
                        <dt>Conversación</dt>
                        <dd>
                          <a
                            href={intercomConversationUrl(conversationId) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#ff592f", fontWeight: 600 }}
                          >
                            Abrir en Intercom <ExternalLink size={12} />
                          </a>
                        </dd>
                      </>
                    )}
                    {rma.logistics && (<><dt>Logística</dt><dd>{RMA_LOGISTICS_LABELS[rma.logistics as keyof typeof RMA_LOGISTICS_LABELS] ?? rma.logistics}</dd></>)}
                    {rma.repairPath && (<><dt>Vía de reparación</dt><dd>{RMA_REPAIR_PATH_LABELS[rma.repairPath as keyof typeof RMA_REPAIR_PATH_LABELS] ?? rma.repairPath}</dd></>)}
                    {rma.outcome && (<><dt>Resultado</dt><dd>{RMA_OUTCOME_LABELS[rma.outcome as keyof typeof RMA_OUTCOME_LABELS] ?? rma.outcome}</dd></>)}
                    <dt>Abierto</dt><dd>{formatDateTime(rma.createdAt)}</dd>
                    <dt>Última actualización</dt><dd>{formatDateTime(rma.updatedAt)}</dd>
                  </dl>

                  {/* Datos de recogida/envío guardados (solo lectura). Se editan con el botón "Datos de recogida/envío". */}
                  {rma.shipping && (rma.shipping.locationName || rma.shipping.contactName || rma.shipping.contactPhone || rma.shipping.contactEmail || rma.shipping.address || rma.shipping.destination?.address || rma.shipping.destination?.name) ? (
                    <div>
                      <div className="field__label" style={{ marginBottom: 8 }}>Datos de recogida y envío</div>
                      <div className="card" style={{ padding: 16 }}>
                        <dl className="dl" style={{ margin: 0 }}>
                          {rma.shipping.locationName && (<><dt>Local</dt><dd>{rma.shipping.locationName}</dd></>)}
                          {rma.shipping.contactName && (<><dt>Contacto</dt><dd>{rma.shipping.contactName}</dd></>)}
                          {rma.shipping.contactPhone && (<><dt>Teléfono</dt><dd className="mono">{rma.shipping.contactPhone}</dd></>)}
                          {rma.shipping.contactEmail && (<><dt>Email</dt><dd>{rma.shipping.contactEmail}</dd></>)}
                          {(rma.shipping.address || rma.shipping.city || rma.shipping.postalCode) && (
                            <><dt>Dirección</dt><dd>{[rma.shipping.address, [rma.shipping.postalCode, rma.shipping.city].filter(Boolean).join(" "), rma.shipping.province].filter(Boolean).join(", ")}</dd></>
                          )}
                          {rma.shipping.instructions && (<><dt>Instrucciones</dt><dd>{rma.shipping.instructions}</dd></>)}
                          {rma.shipping.destination && (rma.shipping.destination.address || rma.shipping.destination.name) && (
                            <><dt>Destino</dt><dd>{[rma.shipping.destination.name, rma.shipping.destination.address, [rma.shipping.destination.postalCode, rma.shipping.destination.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</dd></>
                          )}
                        </dl>
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              <Field label="Nº RMA del proveedor" hint="Código que devuelve el proveedor al autorizar">
                <input className="input mono" placeholder="Pendiente" value={providerRma}
                  onChange={(e) => setProviderRma(e.target.value)}
                  onBlur={() => providerRma !== (rma.providerRmaNumber ?? "") && updateM.mutate({ providerRmaNumber: providerRma })} />
              </Field>

              <div className="row row--2">
                <Field label="Seguimiento (envío)">
                  <input className="input mono" placeholder="Tracking salida" value={trackingOut}
                    onChange={(e) => setTrackingOut(e.target.value)}
                    onBlur={() => trackingOut !== (rma.trackingNumberOutgoing ?? "") && updateM.mutate({ trackingNumberOutgoing: trackingOut })} />
                </Field>
                <Field label="Seguimiento (retorno)">
                  <input className="input mono" placeholder="Tracking retorno" value={trackingIn}
                    onChange={(e) => setTrackingIn(e.target.value)}
                    onBlur={() => trackingIn !== (rma.trackingNumberReturn ?? "") && updateM.mutate({ trackingNumberReturn: trackingIn })} />
                </Field>
              </div>

              <Field label="Notas generales">
                <textarea className="textarea" placeholder="Notas internas del RMA…" value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => notes !== (rma.notes ?? "") && updateM.mutate({ notes })} />
              </Field>

              {/* Notas de técnicos (historial) */}
              <div className="stack" style={{ gap: 8 }}>
                <div className="field__label">Añadir nota al historial</div>
                <ManualNoteForm entityType="rma" entityId={rma.id} />
              </div>

              {/* Recordatorios / seguimientos */}
              <ReminderSection entityType="rma" entityId={rma.id} defaultTitle={`Seguimiento RMA ${rma.rmaNumber}`} />
            </div>
          )}

          {conversationId && chatOpen && (
            <ConversationPopup
              conversationId={conversationId}
              title={`Conversación · RMA ${rma.rmaNumber}`}
              intercomUrl={rma.clientIntercomUrl}
              onClose={() => setChatOpen(false)}
            />
          )}

          {tab === "timeline" && <EventLogTimeline entityType="rma" entityId={rma.id} />}

          {tab === "adjuntos" && (
            <div className="stack">
              <AttachmentSection entityType="rma" entityId={rma.id} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
