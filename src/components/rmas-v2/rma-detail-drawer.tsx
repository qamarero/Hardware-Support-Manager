"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, Clock, Pencil, X, MessageSquare, Printer, ExternalLink } from "lucide-react";
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
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date-format";

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

  const isEarly = rma ? ["borrador", "solicitado"].includes(rma.status) : false;
  const shipping = rma?.shipping ?? null;
  const hasShipping = Boolean(
    shipping &&
      (shipping.contactName ||
        shipping.contactPhone ||
        shipping.contactEmail ||
        shipping.address ||
        shipping.destination?.address ||
        shipping.destination?.name)
  );

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
        {/* Las acciones viven aquí: quedan a mano al hacer scroll y dejan de
            empujar la información hacia el fondo del panel. */}
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
        <a
          href={`/etiqueta/rma/${rma.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--outline btn--sm"
          title="Imprimir etiqueta física (100×150) u hoja A4 de envío"
        >
          <Printer size={14} /> Etiqueta
        </a>
        <RmaProviderEmail rma={rma} />
        {conversationId && (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setChatOpen(true)}>
            <MessageSquare size={14} /> Conversación
          </button>
        )}
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
      title={rma ? (rma.clientCompanyName ?? rma.clientName ?? "Sin cliente asignado") : "Cargando…"}
      subtitle={
        rma ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span className="mono"><CopyId value={rma.rmaNumber} /></span>
            {rma.incidentNumber && (
              <>
                <span aria-hidden>·</span>
                {rma.incidentId ? (
                  <button
                    type="button"
                    onClick={() => openIncident(rma.incidentId!)}
                    title="Abrir la incidencia vinculada"
                    style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--primary)", font: "inherit" }}
                  >
                    {rma.incidentNumber} ↗
                  </button>
                ) : (
                  <span>{rma.incidentNumber}</span>
                )}
              </>
            )}
            <span aria-hidden>·</span>
            <span title={formatDateTime(rma.createdAt)}>abierto {formatRelativeTime(rma.createdAt)}</span>
          </span>
        ) : undefined
      }
      footer={footer}
      width={760}
    >
      {isLoading || !rma ? (
        <div className="flex items-center gap-2 muted" style={{ padding: 24 }}>
          <Loader2 className="animate-spin" size={16} /> Cargando RMA…
        </div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          {/* Una sola tira: estado, SLA, proveedor y lo que bloquea el caso.
              El identificador ya está en la cabecera. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <RmaStatusBadge status={rma.status} />
            {isPaused && (
              <span
                className="badge badge--blue"
                title={`El tiempo en ${RMA_STATUS_LABELS[rma.status as RmaStatus]} no cuenta para el plazo: el equipo está fuera de nuestro alcance`}
              >
                <Clock size={12} /> SLA en pausa
              </span>
            )}
            {rma.providerName && <span className="badge badge--purple">{rma.providerName}</span>}
            {!rma.providerRmaNumber && !isEarly && (
              <span className="badge badge--amber" title="El proveedor aún no ha devuelto su número de RMA">
                Nº proveedor pendiente
              </span>
            )}
            {rma.outcome && (
              <span className="badge badge--green">
                {RMA_OUTCOME_LABELS[rma.outcome as keyof typeof RMA_OUTCOME_LABELS] ?? rma.outcome}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === "detalle" ? "is-active" : ""}`} onClick={() => setTab("detalle")}>Detalle</button>
            <button className={`tab ${tab === "timeline" ? "is-active" : ""}`} onClick={() => setTab("timeline")}>Timeline</button>
            <button className={`tab ${tab === "adjuntos" ? "is-active" : ""}`} onClick={() => setTab("adjuntos")}>Adjuntos</button>
          </div>

          {tab === "detalle" && (
            <div className="stack" style={{ gap: 18 }}>
              {editing && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}><X size={14} /> Cancelar</button>
                  <button className="btn btn--primary btn--sm" onClick={saveEdit} disabled={updateM.isPending}>
                    {updateM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                  </button>
                </div>
              )}

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
                  {/* El equipo: qué se envía y por qué. El motivo estaba enterrado
                      en «Notas generales», al final del panel. */}
                  <div className="grp">
                    <div className="grp__title">El equipo</div>
                    <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span className="fw-700" style={{ fontSize: 13 }}>
                        {[rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" ") || "Sin especificar"}
                      </span>
                      {rma.deviceType && <span className="badge badge--gray">{rma.deviceType}</span>}
                    </div>
                    {rma.deviceSerialNumber && <div className="text-xs muted mono">{rma.deviceSerialNumber}</div>}
                    {rma.notes && (
                      <div style={{ fontSize: 12.5, whiteSpace: "pre-line" }}>{rma.notes}</div>
                    )}
                  </div>

                  <div className="grp">
                    <div className="grp__title">Con el proveedor</div>
                    <div className="row row--2">
                      <Field label="Nº RMA del proveedor" hint="Código que devuelve el proveedor al autorizar">
                        <input className="input mono" placeholder="Pendiente" value={providerRma}
                          onChange={(e) => setProviderRma(e.target.value)}
                          onBlur={() => providerRma !== (rma.providerRmaNumber ?? "") && updateM.mutate({ providerRmaNumber: providerRma })} />
                      </Field>
                      <Field label="Seguimiento (envío)">
                        <input className="input mono" placeholder="Tracking salida" value={trackingOut}
                          onChange={(e) => setTrackingOut(e.target.value)}
                          onBlur={() => trackingOut !== (rma.trackingNumberOutgoing ?? "") && updateM.mutate({ trackingNumberOutgoing: trackingOut })} />
                      </Field>
                    </div>
                    <div className="row row--2">
                      <Field label="Seguimiento (retorno)">
                        <input className="input mono" placeholder="Tracking retorno" value={trackingIn}
                          onChange={(e) => setTrackingIn(e.target.value)}
                          onBlur={() => trackingIn !== (rma.trackingNumberReturn ?? "") && updateM.mutate({ trackingNumberReturn: trackingIn })} />
                      </Field>
                      <div className="text-xs muted" style={{ alignSelf: "end", paddingBottom: 8 }}>
                        {[
                          rma.logistics ? RMA_LOGISTICS_LABELS[rma.logistics as keyof typeof RMA_LOGISTICS_LABELS] ?? rma.logistics : null,
                          rma.repairPath ? RMA_REPAIR_PATH_LABELS[rma.repairPath as keyof typeof RMA_REPAIR_PATH_LABELS] ?? rma.repairPath : null,
                        ].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {/* Las instrucciones se abren solas solo mientras se está
                        tramitando: con el equipo ya enviado, esos pasos ya se dieron. */}
                    {rma.providerId && (
                      <details className="fold" open={isEarly}>
                        <summary>Cómo tramitar con {rma.providerName ?? "el proveedor"}</summary>
                        <div className="fold__body">
                          <ProviderRmaProcedure providerId={rma.providerId} />
                        </div>
                      </details>
                    )}
                  </div>

                  {hasShipping && shipping && (
                    <div className="grp">
                      <div className="grp__title">Recogida</div>
                      {(shipping.address || shipping.city || shipping.postalCode) && (
                        <div style={{ fontSize: 12.5 }}>
                          {[shipping.address, [shipping.postalCode, shipping.city].filter(Boolean).join(" "), shipping.province].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {(shipping.contactName || shipping.contactPhone || shipping.contactEmail) && (
                        <div className="text-xs muted">
                          {shipping.contactName ? <>Recoger con <span className="fw-600" style={{ color: "var(--fg-primary)" }}>{shipping.contactName}</span></> : "Contacto de recogida"}
                          {shipping.contactPhone ? ` · ${shipping.contactPhone}` : ""}
                          {shipping.contactEmail ? ` · ${shipping.contactEmail}` : ""}
                        </div>
                      )}
                      {shipping.instructions && <div className="text-xs muted">{shipping.instructions}</div>}
                      {shipping.destination && (shipping.destination.address || shipping.destination.name) && (
                        <div className="text-xs muted">
                          Destino: {[shipping.destination.name, shipping.destination.address, [shipping.destination.postalCode, shipping.destination.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 2 }}>
                        <RmaShippingDialog rma={rma} />
                      </div>
                    </div>
                  )}

                  <div className="grp">
                    <div className="grp__title">Gestión</div>
                    <div className="text-xs muted" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {rma.contactName && <><span>Contacto de la incidencia: {rma.contactName}</span><span aria-hidden>·</span></>}
                      {conversationId && (
                        <>
                          <a
                            href={intercomConversationUrl(conversationId) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ds-link"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            Abrir en Intercom <ExternalLink size={12} />
                          </a>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <span title={formatDateTime(rma.updatedAt)}>actualizado {formatRelativeTime(rma.updatedAt)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      <button className="btn btn--outline btn--sm" onClick={startEdit}><Pencil size={14} /> Editar datos</button>
                      {!hasShipping && <RmaShippingDialog rma={rma} />}
                    </div>

                    {/* La rejilla completa se queda accesible, plegada: el estado
                        actual ya está en la tira y cambiarlo se hace abajo. */}
                    <details className="fold">
                      <summary>Ver todos los estados del RMA</summary>
                      <div className="fold__body">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {SELECTABLE_RMA_STATUSES.map((st) => {
                            const active = st === rma.status;
                            return (
                              <span
                                key={st}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "5px 12px", borderRadius: 999, fontSize: 12,
                                  fontWeight: active ? 700 : 500,
                                  background: active ? "var(--primary)" : "var(--gray-50)",
                                  color: active ? "#fff" : "var(--gray-600)",
                                  border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                                }}
                              >
                                {active && <span style={{ width: 6, height: 6, borderRadius: 50, background: "#fff" }} />}
                                {RMA_STATUS_LABELS[st]}
                              </span>
                            );
                          })}
                        </div>
                        <div className="text-xs muted">
                          Los estados no son secuenciales: marcan la situación actual, no un orden por el que haya que pasar.
                        </div>
                      </div>
                    </details>

                    <details className="fold">
                      <summary>Notas generales del RMA y recordatorios</summary>
                      <div className="fold__body">
                        <Field label="Notas generales" hint="Nota fija del RMA — para el historial, usa el cuadro de abajo">
                          <textarea className="textarea" placeholder="Notas internas del RMA…" value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onBlur={() => notes !== (rma.notes ?? "") && updateM.mutate({ notes })} />
                        </Field>
                        <ReminderSection entityType="rma" entityId={rma.id} defaultTitle={`Seguimiento RMA ${rma.rmaNumber}`} />
                      </div>
                    </details>
                  </div>

                  {/* La nota está en las dos pestañas a propósito: se deja la
                      información desde donde uno esté, sin cambiar de sitio. */}
                  <div className="grp">
                    <div className="grp__title">Añadir nota al historial</div>
                    <ManualNoteForm entityType="rma" entityId={rma.id} />
                  </div>
                </>
              )}
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

          {tab === "timeline" && (
            <EventLogTimeline
              entityType="rma"
              entityId={rma.id}
              composer={<ManualNoteForm entityType="rma" entityId={rma.id} />}
            />
          )}

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
