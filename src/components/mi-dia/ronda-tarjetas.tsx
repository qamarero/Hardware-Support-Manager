"use client";

import { useEffect, useState } from "react";
import { PartyPopper, SkipForward, Check, FileText } from "lucide-react";
import { IncidentStatusBadge, RmaStatusBadge } from "@/components/proto/badges";
import { formatRelativeTime } from "@/lib/utils/date-format";
import { ContactButton, NextStepButton, IntercomHint, IntercomLink, type RoundItem } from "./ronda-actions";

/**
 * Vista "tarjetas" de la ronda diaria: baraja que muestra la incidencia/RMA
 * actual con su señal de Intercom y acciones rápidas. Avanzas con "Saltar" (no
 * marca) o "Revisada" (marca la del día y pasa a la siguiente). Atajos: → / Enter
 * revisada, S saltar, C contacté.
 */
export function RondaTarjetas({
  items,
  onOpen,
  onReviewed,
  reviewedToday,
}: {
  items: RoundItem[];
  onOpen: (item: RoundItem) => void;
  onReviewed: (item: RoundItem) => void;
  reviewedToday: number;
}) {
  const [pos, setPos] = useState(0);
  const total = items.length + reviewedToday;
  const idx = items.length ? pos % items.length : 0;
  const current: RoundItem | undefined = items[idx];

  const skip = () => setPos((p) => p + 1);
  const review = () => { if (current) onReviewed(current); };

  // Atajos de teclado (ignora si estás escribiendo en un campo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); review(); }
      else if (e.key.toLowerCase() === "s") { e.preventDefault(); skip(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) {
    return (
      <div className="card empty" style={{ padding: 32, textAlign: "center" }}>
        <PartyPopper size={30} color="var(--primary)" />
        <h4 style={{ marginTop: 8 }}>¡Ronda del día completada!</h4>
        <div className="text-sm muted">Has revisado {reviewedToday} {reviewedToday === 1 ? "elemento" : "elementos"} hoy. Nada más pendiente en tu cola.</div>
      </div>
    );
  }

  const pct = total > 0 ? Math.round((reviewedToday / total) * 100) : 0;

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* Progreso */}
      <div className="stack" style={{ gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span className="muted">Revisadas hoy <strong style={{ color: "var(--fg)" }}>{reviewedToday}</strong> · Pendientes <strong style={{ color: "var(--fg)" }}>{items.length}</strong></span>
          <span className="muted">{idx + 1}/{items.length}</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--gray-100)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "var(--primary)", transition: "width 250ms cubic-bezier(0.16,1,0.3,1)" }} />
        </div>
      </div>

      {/* Tarjeta actual */}
      <div key={current.kind + current.id} className="card" style={{ padding: 20, animation: "fadeInUp 220ms cubic-bezier(0.16,1,0.3,1) both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <span className="chip" style={{ fontSize: 11 }}>{current.kind === "incident" ? "Incidencia" : "RMA"}</span>
          <span className="id-cell mono fw-700">{current.number}</span>
          {current.kind === "incident" ? <IncidentStatusBadge status={current.status} /> : <RmaStatusBadge status={current.status} />}
          <div style={{ flex: 1 }} />
          <span className="text-xs muted">Creada {formatRelativeTime(current.createdAt)}</span>
        </div>

        <div className="fw-700" style={{ fontSize: 16 }}>{current.title}</div>
        <div className="text-sm muted" style={{ marginBottom: 14 }}>{current.client ?? "Sin cliente"}</div>

        {/* Señal Intercom (auto, orientativa) */}
        <div style={{ background: "var(--gray-50)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <IntercomHint conversationId={current.conversationId} active />
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <ContactButton item={current} />
          <NextStepButton item={current} />
          <button className="btn btn--outline btn--sm" onClick={() => onOpen(current)} title="Abrir ficha (cambiar estado, notas…)"><FileText size={14} /> Abrir ficha</button>
          <IntercomLink conversationId={current.conversationId} />
        </div>

        {/* Avanzar */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <button className="btn btn--ghost btn--sm" onClick={skip} title="Pasar sin marcar (tecla S)"><SkipForward size={14} /> Saltar</button>
          <button className="btn btn--primary btn--sm" onClick={review} title="Marcar revisada y pasar a la siguiente (tecla → o Enter)"><Check size={14} /> Revisada · Siguiente</button>
        </div>
      </div>
    </div>
  );
}
