"use client";

import { INCIDENT_STATUS_LABELS, INCIDENT_PRIORITY_LABELS, type IncidentStatus, type IncidentPriority } from "@/lib/constants/incidents";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import { DEFAULT_SLA_THRESHOLDS } from "@/lib/constants/sla";
import { PAUSED_INCIDENT_STATES } from "@/lib/constants/statuses";

// ── Mapa estado incidencia → color de badge del prototipo ──
const INCIDENT_BADGE: Record<string, string> = {
  nuevo: "badge--red",
  en_triaje: "badge--amber",
  en_gestion: "badge--amber",
  esperando_cliente: "badge--blue",
  esperando_proveedor: "badge--blue",
  esperando_pieza: "badge--purple",
  resuelto: "badge--green",
  cerrado: "badge--gray",
  cancelado: "badge--gray",
};

const RMA_BADGE: Record<string, string> = {
  borrador: "badge--gray",
  solicitado: "badge--blue",
  aprobado: "badge--blue",
  enviado_proveedor: "badge--amber",
  en_proveedor: "badge--amber",
  devuelto: "badge--purple",
  recibido_oficina: "badge--blue",
  esperando_cliente: "badge--amber",
  entregado_cliente: "badge--green",
  rechazado: "badge--red",
  cerrado: "badge--gray",
  cancelado: "badge--gray",
};

export function IncidentStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge--dot ${INCIDENT_BADGE[status] ?? "badge--gray"}`}>
      {INCIDENT_STATUS_LABELS[status as IncidentStatus] ?? status}
    </span>
  );
}

export function RmaStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge--dot ${RMA_BADGE[status] ?? "badge--gray"}`}>
      {RMA_STATUS_LABELS[status as RmaStatus] ?? status}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  // Binario: bloquea operativa (alta/crítica) → rojo; puede operar (baja/media) → neutro.
  const blocking = priority === "critica" || priority === "alta";
  return (
    <span className={`priority ${blocking ? "priority--critica" : "priority--baja"}`}>
      <span className="priority__dot" />
      {INCIDENT_PRIORITY_LABELS[priority as IncidentPriority] ?? priority}
    </span>
  );
}

export function Avatar({ name, size, src }: { name: string; size?: "sm" | "lg" | "xl"; src?: string | null }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const cls = `avatar ${size === "sm" ? "avatar--sm" : size === "lg" ? "avatar--lg" : size === "xl" ? "avatar--xl" : ""}`;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={src} alt={name} style={{ objectFit: "cover" }} />;
  }
  return <div className={cls}>{initials}</div>;
}

/** Progreso de SLA respetando la pausa. Devuelve pct + nivel. */
export function slaProgress(inc: {
  priority: string;
  status: string;
  createdAt: Date | string;
  stateChangedAt: Date | string;
  resolvedAt?: Date | string | null;
  slaPausedMs?: string | number | null;
}): { pct: number; level: "ok" | "warn" | "bad" | "paused"; label: string } {
  const slaHours = DEFAULT_SLA_THRESHOLDS.resolution[inc.priority as IncidentPriority] ?? 168;
  const slaMs = slaHours * 3_600_000;
  const pausedMs = Number(inc.slaPausedMs) || 0;
  const paused = (PAUSED_INCIDENT_STATES as readonly string[]).includes(inc.status);
  const closed = ["resuelto", "cerrado", "cancelado"].includes(inc.status);

  const created = new Date(inc.createdAt).getTime();
  const ref = paused
    ? new Date(inc.stateChangedAt).getTime()
    : closed
      ? new Date(inc.resolvedAt ?? inc.stateChangedAt).getTime()
      : Date.now();
  const elapsed = Math.max(0, ref - created - pausedMs);
  const pct = Math.min(100, Math.round((elapsed / slaMs) * 100));

  let level: "ok" | "warn" | "bad" | "paused";
  if (paused) level = "paused";
  else if (pct >= 100) level = "bad";
  else if (pct >= 75) level = "warn";
  else level = "ok";

  const hoursLeft = Math.round((slaMs - elapsed) / 3_600_000);
  const label = paused ? "En pausa" : pct >= 100 ? `+${Math.abs(hoursLeft)}h fuera de SLA` : `${hoursLeft}h restantes`;
  return { pct, level, label };
}

export function SlaBar({ incident }: { incident: Parameters<typeof slaProgress>[0] }) {
  const { pct, level } = slaProgress(incident);
  if (level === "paused") {
    return (
      <span className="sla-text--paused">
        ⏸ En pausa
      </span>
    );
  }
  return (
    <div className="sla-bar" title={slaProgress(incident).label}>
      <div className={`sla-bar__fill sla-bar__fill--${level}`} style={{ width: `${Math.max(4, pct)}%` }} />
    </div>
  );
}
