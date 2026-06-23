"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, Clock, Ticket, Pencil, X } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { RmaStatusBadge } from "@/components/proto/badges";
import { AttachmentSection } from "@/components/shared/attachment-section";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { ManualNoteForm } from "@/components/shared/manual-note-form";
import { ReminderSection } from "@/components/reminders/reminder-section";
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
  "borrador", "solicitado", "aprobado", "enviado_proveedor", "en_proveedor", "devuelto", "recibido_oficina", "entregado_cliente", "cerrado",
];

export function RmaDetailDrawer({ rmaId, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"detalle" | "timeline" | "adjuntos">("detalle");
  const [providerRma, setProviderRma] = useState("");
  const [trackingOut, setTrackingOut] = useState("");
  const [trackingIn, setTrackingIn] = useState("");
  const [notes, setNotes] = useState("");

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
    mutationFn: (toStatus: string) => transitionRma({ rmaId: rmaId!, toStatus }),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Estado actualizado");
      invalidate();
    },
    onError: () => toast.error("Error al cambiar estado"),
  });

  if (!rmaId) return null;

  const transitions = rma ? getRmaAvailableTransitions(rma.status as RmaStatus, "admin") : [];
  const isPaused = rma ? (PAUSED_RMA_STATES as readonly string[]).includes(rma.status) : false;
  const currentIdx = rma ? STAGES.indexOf(rma.status as RmaStatus) : -1;
  const nextStage = currentIdx >= 0 && currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;
  const canAdvance = nextStage ? transitions.some((t) => t.to === nextStage) : false;

  const footer = rma ? (
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
          <option key={t.to} value={t.to}>{RMA_STATUS_LABELS[t.to as RmaStatus]}</option>
        ))}
      </select>
      <div style={{ flex: 1 }} />
      {nextStage && canAdvance && (
        <button className="btn btn--primary btn--sm" onClick={() => transitionM.mutate(nextStage)} disabled={transitionM.isPending}>
          <Check size={14} /> Avanzar a {RMA_STATUS_LABELS[nextStage]}
        </button>
      )}
    </>
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
            <RmaStatusBadge status={rma.status} />
            {rma.incidentNumber && (
              <span className="badge badge--outline">
                <Ticket size={12} /> Incidencia {rma.incidentNumber}
              </span>
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

          {/* Stepper */}
          <div className="card" style={{ padding: 20 }}>
            <div className="field__label" style={{ marginBottom: 14 }}>Progreso</div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
              {STAGES.map((s, idx) => {
                const isDone = idx <= currentIdx;
                const isActive = idx === currentIdx;
                return (
                  <div key={s} style={{ display: "contents" }}>
                    <div style={{ textAlign: "center", flex: "0 0 auto", width: 78 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 50,
                        background: isDone ? "var(--primary)" : "var(--gray-200)",
                        color: isDone ? "#fff" : "var(--gray-500)",
                        display: "grid", placeItems: "center", margin: "0 auto",
                        fontWeight: 700, fontSize: 11,
                        border: isActive ? "3px solid var(--orange-200)" : "none",
                      }}>
                        {isDone && !isActive ? <Check size={12} /> : idx + 1}
                      </div>
                      <div style={{ fontSize: 9.5, marginTop: 6, lineHeight: 1.2, color: isDone ? "var(--fg-primary)" : "var(--fg-tertiary)", fontWeight: isActive ? 700 : 500 }}>
                        {RMA_STATUS_LABELS[s]}
                      </div>
                    </div>
                    {idx < STAGES.length - 1 && (
                      <div style={{ flex: 1, height: 2, marginTop: 14, background: idx < currentIdx ? "var(--primary)" : "var(--gray-200)" }} />
                    )}
                  </div>
                );
              })}
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
              {/* Toggle editar datos */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
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
                    {rma.logistics && (<><dt>Logística</dt><dd>{RMA_LOGISTICS_LABELS[rma.logistics as keyof typeof RMA_LOGISTICS_LABELS] ?? rma.logistics}</dd></>)}
                    {rma.repairPath && (<><dt>Vía de reparación</dt><dd>{RMA_REPAIR_PATH_LABELS[rma.repairPath as keyof typeof RMA_REPAIR_PATH_LABELS] ?? rma.repairPath}</dd></>)}
                    {rma.outcome && (<><dt>Resultado</dt><dd>{RMA_OUTCOME_LABELS[rma.outcome as keyof typeof RMA_OUTCOME_LABELS] ?? rma.outcome}</dd></>)}
                    <dt>Abierto</dt><dd>{formatDateTime(rma.createdAt)}</dd>
                    <dt>Última actualización</dt><dd>{formatDateTime(rma.updatedAt)}</dd>
                  </dl>
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
