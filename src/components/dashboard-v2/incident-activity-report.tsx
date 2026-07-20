"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ArrowRight, Phone, Plus, Flag } from "lucide-react";
import { fetchWeeklyIncidentActivity } from "@/server/actions/support-metrics";
import { CopyId } from "@/components/proto/copy-id";
import { IncidentStatusBadge } from "@/components/proto/badges";
import {
  INCIDENT_STATUS_LABELS,
  type IncidentStatus,
} from "@/lib/constants/incidents";
import type { WeeklyIncidentActivityRow } from "@/server/queries/incident-metrics";

function stLabel(s: string | null): string {
  if (!s) return "—";
  return INCIDENT_STATUS_LABELS[s as IncidentStatus] ?? s;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Etiqueta del resultado de una incidencia cerrada esa semana. */
function resultLabel(row: WeeklyIncidentActivityRow): string {
  const closure = [...row.events].reverse().find((e) => e.isClosure);
  if (closure?.toState === "cancelado") return "Cancelada";
  if (row.resolutionType === "derivado_rma") return "Derivada a RMA";
  return "Resuelta";
}

function EventLine({
  icon,
  children,
  when,
  who,
  accent,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  when: string;
  who: string | null;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        fontSize: 13,
        padding: "3px 0",
      }}
    >
      <span style={{ flexShrink: 0, color: accent ? "var(--primary)" : "var(--fg-tertiary)", transform: "translateY(2px)" }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {children}
        {who && <span className="muted"> · {who.split(" ")[0]}</span>}
      </span>
      <span className="muted" style={{ flexShrink: 0, fontSize: 11 }}>
        {fmtDateTime(when)}
      </span>
    </div>
  );
}

function IncidentCard({ row }: { row: WeeklyIncidentActivityRow }) {
  return (
    <div
      className="card"
      style={{
        padding: 14,
        borderLeft: row.closedThisWeek ? "3px solid var(--primary)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span className="id-cell" style={{ flexShrink: 0 }}>{row.incidentNumber}</span>
        <span className="fw-600" style={{ flex: 1, minWidth: 120 }}>{row.title}</span>
        <IncidentStatusBadge status={row.currentStatus as IncidentStatus} />
      </div>

      <div className="muted" style={{ fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>{row.clientCompanyName ?? "Sin cliente"}</span>
        {row.clientExternalId && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
            <span style={{ fontSize: 10, fontWeight: 700 }}>ID</span>
            <CopyId value={row.clientExternalId} label={`${row.clientExternalId.slice(0, 8)}…`} />
          </span>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
        {row.events.map((e, i) => {
          if (e.action === "created") {
            return (
              <EventLine key={i} icon={<Plus size={14} />} when={e.createdAt} who={e.userName}>
                Creada
              </EventLine>
            );
          }
          if (e.action === "contacted") {
            return (
              <EventLine key={i} icon={<Phone size={14} />} when={e.createdAt} who={e.userName}>
                Contacto al cliente
              </EventLine>
            );
          }
          // transition
          return (
            <EventLine key={i} icon={<ArrowRight size={14} />} when={e.createdAt} who={e.userName} accent={e.isClosure}>
              <span className="muted">Estado:</span> {stLabel(e.fromState)}{" → "}
              <span className="fw-600">{stLabel(e.toState)}</span>
            </EventLine>
          );
        })}
      </div>

      {row.closedThisWeek && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px dashed var(--border)",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            fontSize: 13,
          }}
        >
          <Flag size={14} style={{ flexShrink: 0, color: "var(--primary)", transform: "translateY(2px)" }} />
          <span>
            <span className="fw-600">Resultado: {resultLabel(row)}</span>
            {row.resolution && <span className="muted"> — {row.resolution}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs muted">{label}</div>
      <div className="fw-700 mono" style={{ fontSize: 22 }}>{value}</div>
    </div>
  );
}

export function IncidentActivityReport({ weekStart }: { weekStart: string }) {
  const { data, isPending, refetch, isFetching } = useQuery({
    queryKey: ["incident-activity", weekStart],
    queryFn: () => fetchWeeklyIncidentActivity(weekStart),
  });
  const isError = data === null;

  return (
    <section style={{ marginTop: 24 }}>
      <h3 className="ds-h3" style={{ marginBottom: 4 }}>Actividad de incidencias</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Cambios de estado, contactos al cliente y cierres de la semana, por incidencia.
      </p>

      {isError ? (
        <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="flex items-center gap-2 text-sm" style={{ color: "var(--red-600, #dc2626)" }}>
            <AlertTriangle size={14} /> No se pudo cargar la actividad.
          </span>
          <button type="button" className="btn btn--outline btn--sm no-print" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 size={13} className="animate-spin" /> : "Reintentar"}
          </button>
        </div>
      ) : isPending || !data ? (
        <div className="card" style={{ padding: 14 }}>
          <div className="flex items-center gap-2 muted text-sm">
            <Loader2 size={14} className="animate-spin" /> Cargando…
          </div>
        </div>
      ) : data.rows.length === 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <div className="muted text-sm">Sin actividad de incidencias en esta semana.</div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="card" style={{ padding: 14, display: "flex", gap: 28, flexWrap: "wrap" }}>
            <Stat label="Incidencias con actividad" value={data.totals.incidents} />
            <Stat label="Cambios de estado" value={data.totals.stateChanges} />
            <Stat label="Contactos al cliente" value={data.totals.contacts} />
            <Stat label="Cerradas" value={data.totals.closed} />
          </div>
          {data.rows.map((row) => (
            <IncidentCard key={row.incidentId} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
