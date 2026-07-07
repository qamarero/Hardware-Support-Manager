"use client";

import { Check } from "lucide-react";
import { IncidentStatusBadge, RmaStatusBadge } from "@/components/proto/badges";
import { formatRelativeTime } from "@/lib/utils/date-format";
import { ContactButton, NextStepButton, IntercomLink, type RoundItem, reviewKeyOf } from "./ronda-actions";

/**
 * Vista "tabla" de la ronda: la misma cola de forma compacta, para ver de un
 * vistazo qué llevas. Muestra la última vez que registraste contacto y una
 * marca "revisada hoy" que puedes alternar. (El hint automático de Intercom
 * vive en la vista de tarjetas para no disparar una llamada por fila.)
 */
export function RondaTabla({
  items,
  isReviewed,
  onToggleReviewed,
  onOpen,
}: {
  items: RoundItem[];
  isReviewed: (key: string) => boolean;
  onToggleReviewed: (item: RoundItem) => void;
  onOpen: (item: RoundItem) => void;
}) {
  if (items.length === 0) {
    return <div className="muted text-sm" style={{ padding: "8px 2px" }}>Nada en tu cola de hoy 🎉</div>;
  }
  return (
    <div className="table-wrap">
      <table className="table table--dense">
        <thead>
          <tr>
            <th style={{ width: 34 }}>✓</th>
            <th>ID</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Creada</th>
            <th>Últ. contacto</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const done = isReviewed(reviewKeyOf(it));
            return (
              <tr key={it.kind + it.id} onClick={() => onOpen(it)} style={{ cursor: "pointer", opacity: done ? 0.5 : 1 }}>
                <td onClick={(e) => { e.stopPropagation(); onToggleReviewed(it); }} style={{ textAlign: "center" }}>
                  <span
                    role="checkbox"
                    aria-checked={done}
                    title={done ? "Revisada hoy — clic para desmarcar" : "Marcar revisada hoy"}
                    style={{ display: "inline-grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${done ? "var(--primary)" : "var(--border)"}`, background: done ? "var(--primary)" : "#fff", cursor: "pointer" }}
                  >
                    {done && <Check size={13} color="#fff" />}
                  </span>
                </td>
                <td className="id-cell mono">{it.number}</td>
                <td className="text-sm">{it.client ?? "—"}</td>
                <td>{it.kind === "incident" ? <IncidentStatusBadge status={it.status} /> : <RmaStatusBadge status={it.status} />}</td>
                <td className="text-sm muted">{formatRelativeTime(it.createdAt)}</td>
                <td className="text-sm muted">{it.lastContactedAt ? formatRelativeTime(it.lastContactedAt) : "—"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <ContactButton item={it} size="xs" />
                    <NextStepButton item={it} size="xs" />
                    <IntercomLink conversationId={it.conversationId} size="xs" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
