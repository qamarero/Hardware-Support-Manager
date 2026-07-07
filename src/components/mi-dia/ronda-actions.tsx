"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Bell, Loader2, Check, ExternalLink, MessageSquare } from "lucide-react";
import { logContact } from "@/server/actions/follow-up";
import { createReminder } from "@/server/actions/reminders";
import { useClientReplyStatus } from "@/hooks/use-client-reply-status";
import { intercomConversationUrl } from "@/lib/utils/intercom-url";
import { formatRelativeTime } from "@/lib/utils/date-format";
import { ConversationPopup } from "@/components/proto/conversation-popup";

/** Un elemento de la ronda diaria (incidencia o RMA), unificado. */
export interface RoundItem {
  kind: "incident" | "rma";
  id: string;
  number: string;
  title: string;
  client: string | null;
  status: string;
  createdAt: string | Date;
  conversationId: string | null;
  /** Última marca "contacté" (event_logs); solo incidencias por ahora. */
  lastContactedAt?: string | null;
}

export function reviewKeyOf(item: RoundItem): string {
  return `${item.kind}:${item.id}`;
}

function fromEpoch(sec: number): Date {
  return new Date(sec * 1000);
}

/**
 * Chip/bloque orientativo de Intercom: muestra cuándo escribió el cliente por
 * última vez y cuándo lo hicimos nosotros. NO es autoritativo (ver hook).
 */
export function IntercomHint({ conversationId, active }: { conversationId: string | null; active: boolean }) {
  const { data, isLoading } = useClientReplyStatus(conversationId, active);

  if (!conversationId) return <span className="text-xs muted">Sin conversación de Intercom vinculada</span>;
  if (isLoading || !data) return <span className="text-xs muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Loader2 size={12} className="animate-spin" /> Consultando Intercom…</span>;

  const last = data.lastPublicAuthor;
  const chipTone = last === "client" ? "badge--amber" : last === "us" ? "badge--blue" : "badge--gray";
  const chipText = last === "client" ? "El cliente escribió último — te toca" : last === "us" ? "Respondimos nosotros — revisa si el cliente pregunta algo" : "Sin mensajes";

  return (
    <div className="stack" style={{ gap: 4 }}>
      <span className={`badge ${chipTone}`} style={{ width: "fit-content" }}>{chipText}</span>
      <div className="text-xs muted" style={{ lineHeight: 1.5 }}>
        <div>
          <strong>Cliente:</strong>{" "}
          {data.lastClient ? `«${data.lastClient.snippet}» · ${formatRelativeTime(fromEpoch(data.lastClient.at))}` : "sin mensajes"}
        </div>
        <div>
          <strong>Nosotros:</strong>{" "}
          {data.lastOurs ? `«${data.lastOurs.snippet}» · ${formatRelativeTime(fromEpoch(data.lastOurs.at))}` : "sin respuesta"}
        </div>
      </div>
    </div>
  );
}

/** Botón "Contacté al cliente" → registra en event_logs (auditable). */
export function ContactButton({ item, size = "sm" }: { item: RoundItem; size?: "sm" | "xs" }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => logContact({ entityType: item.kind, entityId: item.id }),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success(`Contacto registrado en ${item.number}`);
      qc.invalidateQueries({ queryKey: ["event-logs", item.kind, item.id] });
      qc.invalidateQueries({ queryKey: ["incidents-v2"] });
      qc.invalidateQueries({ queryKey: ["incidents", "mine"] });
    },
    onError: () => toast.error("No se pudo registrar el contacto"),
  });
  return (
    <button className={`btn btn--outline btn--${size}`} onClick={() => m.mutate()} disabled={m.isPending} title="Registrar que has contactado al cliente">
      {m.isPending ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />} Contacté
    </button>
  );
}

const STEP_PRESETS: { label: string; days: number }[] = [
  { label: "Mañana", days: 1 },
  { label: "En 2 días", days: 2 },
  { label: "En 1 semana", days: 7 },
];

function inDaysAt9(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** Botón "Siguiente paso" → crea un recordatorio ligado a la entidad. */
export function NextStepButton({ item, size = "sm" }: { item: RoundItem; size?: "sm" | "xs" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const m = useMutation({
    mutationFn: (dueAt: string) => createReminder({ title: `Seguimiento ${item.number}`, dueAt, entityType: item.kind, entityId: item.id }),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Siguiente paso programado");
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setOpen(false);
    },
    onError: () => toast.error("No se pudo crear el recordatorio"),
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={`btn btn--outline btn--${size}`} onClick={() => setOpen((o) => !o)} title="Programar el siguiente paso (recordatorio)">
        <Bell size={14} /> Siguiente paso
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50, background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-m)", boxShadow: "var(--shadow-elev)", padding: 4, width: 200 }}>
          {STEP_PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => m.mutate(inDaysAt9(p.days))} disabled={m.isPending}
              style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: "8px 10px", borderRadius: "var(--radius-s)", cursor: "pointer", fontSize: 13 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gray-50)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              {p.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, padding: "8px 10px" }}>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>Otra fecha</div>
            <input className="input" type="datetime-local" onChange={(e) => { if (e.target.value) m.mutate(new Date(e.target.value).toISOString()); }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Enlace "Abrir en Intercom" (si hay conversación). */
export function IntercomLink({ conversationId, size = "sm" }: { conversationId: string | null; size?: "sm" | "xs" }) {
  const url = intercomConversationUrl(conversationId);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`btn btn--outline btn--${size}`} title="Abrir la conversación en Intercom">
      <MessageSquare size={14} /> Intercom <ExternalLink size={12} />
    </a>
  );
}

/** Botón "Ver conversación" → abre el hilo de Intercom en un modal (mismo popup
 *  portado a document.body que las tablas). Complementa al enlace externo. */
export function ConversationButton({ item, size = "sm" }: { item: RoundItem; size?: "sm" | "xs" }) {
  const [open, setOpen] = useState(false);
  if (!item.conversationId) return null;
  return (
    <>
      <button className={`btn btn--outline btn--${size}`} onClick={() => setOpen(true)} title="Ver la conversación de Intercom aquí">
        <MessageSquare size={14} /> Ver conversación
      </button>
      {open && (
        <ConversationPopup
          conversationId={item.conversationId}
          title={item.number}
          subtitle={item.client ?? item.title}
          intercomUrl={intercomConversationUrl(item.conversationId)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export { Check };
