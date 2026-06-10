"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Loader2, Plus, ArrowRight, AlertTriangle, Package, Check, Laptop } from "lucide-react";
import { fetchIncidents, fetchUsersForSelect } from "@/server/actions/incidents";
import { fetchRmas } from "@/server/actions/rmas";
import { IncidentStatusBadge, PriorityPill, Avatar, slaProgress } from "@/components/proto/badges";
import { IncidentDetailDrawer } from "@/components/incidents-v2/incident-detail-drawer";
import { formatRelativeTime } from "@/lib/utils/date-format";
import type { IncidentRow } from "@/server/queries/incidents";

function greeting(hour: number): string {
  if (hour < 6) return "Buenas noches";
  if (hour < 13) return "Buenos días";
  if (hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CLOSED = ["resuelto", "cerrado", "cancelado"];
const RESOLVED = ["resuelto", "cerrado"];
const DAY = 86_400_000;

// Buckets del donut → color del token.
const DONUT: { key: string; label: string; match: (s: string) => boolean; color: string }[] = [
  { key: "abierta", label: "Abiertas", match: (s) => s === "nuevo" || s === "en_triaje", color: "var(--red-500)" },
  { key: "en_curso", label: "En curso", match: (s) => s === "en_gestion", color: "var(--amber-500)" },
  { key: "esperando", label: "Esperando", match: (s) => s.startsWith("esperando"), color: "var(--blue-500)" },
  { key: "resuelta", label: "Resueltas", match: (s) => s === "resuelto", color: "var(--green-500)" },
  { key: "cerrada", label: "Cerradas", match: (s) => s === "cerrado" || s === "cancelado", color: "var(--gray-400)" },
];

export function DashboardScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const [incidentId, setIncidentId] = useState<string | null>(null);

  // Reloj: se monta en cliente para evitar mismatch de hidratación; refresca cada minuto.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { data: incData, isLoading } = useQuery({
    queryKey: ["incidents-v2"],
    queryFn: () => fetchIncidents({ page: 1, pageSize: 500, sortBy: "updatedAt", sortOrder: "desc" }),
  });
  const { data: rmaData } = useQuery({
    queryKey: ["rmas-v2"],
    queryFn: () => fetchRmas({ page: 1, pageSize: 500, sortBy: "createdAt", sortOrder: "desc" }),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
  });

  const userName = session?.user?.name ?? "";
  const firstName = userName.split(" ")[0] || "equipo";
  const fecha = now ? capitalize(now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })) : "";
  const hora = now ? now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";

  const incidents: IncidentRow[] = useMemo(() => incData?.data ?? [], [incData]);
  const rmas = useMemo(() => rmaData?.data ?? [], [rmaData]);

  const stats = useMemo(() => {
    const open = incidents.filter((i) => !CLOSED.includes(i.status));
    const waiting = incidents.filter((i) => i.status === "esperando_pieza");
    const resolved7d = incidents.filter((i) => RESOLVED.includes(i.status) && Date.now() - new Date(i.resolvedAt ?? i.updatedAt).getTime() < 7 * DAY);
    const overdue = open.filter((i) => slaProgress(i).level === "bad");
    const activeRmas = rmas.filter((r) => r.status !== "cerrado" && r.status !== "cancelado");
    return { open: open.length, waiting: waiting.length, resolved7d: resolved7d.length, overdue: overdue.length, activeRmas: activeRmas.length };
  }, [incidents, rmas]);

  const last7 = useMemo(() => {
    const days: { label: string; created: number; closed: number }[] = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const inWin = (t: number) => t >= d.getTime() && t < next.getTime();
      const created = incidents.filter((inc) => inWin(new Date(inc.createdAt).getTime())).length;
      const closed = incidents.filter((inc) => RESOLVED.includes(inc.status) && inWin(new Date(inc.resolvedAt ?? inc.updatedAt).getTime())).length;
      days.push({ label: ["D", "L", "M", "X", "J", "V", "S"][d.getDay()], created, closed });
    }
    return days;
  }, [incidents]);
  const maxBar = Math.max(1, ...last7.map((d) => Math.max(d.created, d.closed)));

  const donut = useMemo(() => DONUT.map((b) => ({ ...b, count: incidents.filter((i) => b.match(i.status)).length })).filter((b) => b.count > 0), [incidents]);
  const donutTotal = donut.reduce((a, b) => a + b.count, 0) || 1;

  const recent = useMemo(() => incidents.slice(0, 6), [incidents]);

  const topDevices = useMemo(() => {
    const m = new Map<string, { label: string; serial: string | null; count: number }>();
    for (const i of incidents) {
      if (!i.deviceModel && !i.deviceBrand) continue;
      const label = [i.deviceBrand, i.deviceModel].filter(Boolean).join(" ");
      const k = (i.deviceSerialNumber?.trim() || label).toLowerCase();
      const e = m.get(k) ?? { label, serial: i.deviceSerialNumber, count: 0 };
      e.count++;
      m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [incidents]);

  if (isLoading) {
    return <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando panel…</span></div>;
  }

  // Donut arcs
  const r = 60, circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="stack">
      {/* Hero */}
      <div className="hero">
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="ds-overline" style={{ color: "var(--accent-coral, #ffd4cc)", marginBottom: 8, fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase" }}>
              HARDWARE{fecha ? ` · ${fecha}` : ""}{hora ? ` · ${hora}` : ""}
            </div>
            <h2>{greeting(now ? now.getHours() : 9)}{firstName ? `, ${firstName}` : ""}</h2>
            <p>Hay {stats.open} incidencia{stats.open !== 1 ? "s" : ""} abierta{stats.open !== 1 ? "s" : ""}{stats.overdue > 0 ? `, ${stats.overdue} fuera de SLA` : ""}. {stats.activeRmas} RMA activos en curso.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn btn--primary" onClick={() => router.push("/incidents")}>
                <Plus size={14} /> Nueva incidencia
              </button>
              <button className="btn btn--outline" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }} onClick={() => router.push("/tablero")}>
                Tablero Kanban <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Clúster de avatars del equipo (técnicos conectados) */}
          {users.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div className="ds-overline" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>Equipo</div>
              <div style={{ display: "flex" }}>
                {users.slice(0, 6).map((u, idx) => {
                  const isMe = !!session?.user?.id && u.id === (session.user as { id?: string }).id;
                  return (
                    <div
                      key={u.id}
                      title={u.name + (isMe ? " (tú)" : "")}
                      style={{ marginLeft: idx === 0 ? 0 : -8, borderRadius: "50%", boxShadow: isMe ? "0 0 0 2px var(--primary)" : "0 0 0 2px var(--gray-900)", position: "relative", zIndex: users.length - idx }}
                    >
                      <Avatar name={u.name} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi__label">Abiertas</div>
          <div className="kpi__value">{stats.open}<sup>incidencias</sup></div>
          <div className={`kpi__delta ${stats.overdue > 0 ? "kpi__delta--up" : "kpi__delta--flat"}`}><AlertTriangle size={12} /> {stats.overdue} fuera de SLA</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Esperando pieza</div>
          <div className="kpi__value">{stats.waiting}<sup>tickets</sup></div>
          <div className="kpi__delta kpi__delta--flat"><Package size={12} /> {stats.activeRmas} RMA en curso</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Resueltas (7d)</div>
          <div className="kpi__value">{stats.resolved7d}<sup>tickets</sup></div>
          <div className="kpi__delta kpi__delta--up"><Check size={12} /> últimos 7 días</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">RMA activos</div>
          <div className="kpi__value">{stats.activeRmas}<sup>en curso</sup></div>
          <div className="kpi__delta kpi__delta--flat"><Package size={12} /> con proveedor</div>
        </div>
      </div>

      {/* Charts */}
      <div className="row row--2">
        <div className="card" style={{ padding: 20 }}>
          <div className="field__label" style={{ marginBottom: 4 }}>Actividad de la semana</div>
          <div className="text-xs muted" style={{ marginBottom: 16 }}>Incidencias creadas vs resueltas</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
            {last7.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ height: `${(d.closed / maxBar) * 100}%`, background: "var(--green-500)", borderRadius: "4px 4px 0 0", minHeight: d.closed > 0 ? 4 : 0 }} title={`${d.closed} resueltas`} />
                <div style={{ height: `${(d.created / maxBar) * 100}%`, background: "var(--primary)", borderRadius: "4px 4px 0 0", minHeight: d.created > 0 ? 4 : 0 }} title={`${d.created} creadas`} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {last7.map((d, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-tertiary)" }}>{d.label}</div>)}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--primary)" }} />Creadas</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--green-500)" }} />Resueltas</span>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="field__label" style={{ marginBottom: 4 }}>Estado de tickets</div>
          <div className="text-xs muted" style={{ marginBottom: 16 }}>Distribución actual</div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
              <circle cx="70" cy="70" r={r} fill="none" stroke="var(--gray-100)" strokeWidth="16" />
              {donut.map((b) => {
                const frac = b.count / donutTotal;
                const dash = `${frac * circ} ${circ}`;
                const offset = -acc * circ;
                acc += frac;
                return <circle key={b.key} cx="70" cy="70" r={r} fill="none" stroke={b.color} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={offset} transform="rotate(-90 70 70)" />;
              })}
              <text x="70" y="68" textAnchor="middle" fontWeight="700" fontSize="28" fill="var(--gray-900)">{donutTotal}</text>
              <text x="70" y="86" textAnchor="middle" fontSize="10" fill="var(--gray-600)" style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>incidencias</text>
            </svg>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {donut.map((b) => (
                <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 50, background: b.color }} />
                  <span style={{ flex: 1 }}>{b.label}</span>
                  <span className="mono fw-700">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent + top devices */}
      <div className="row row--2">
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="field__label">Actividad reciente</div>
            <button className="btn btn--ghost btn--sm" onClick={() => router.push("/incidents")}>Ver todas <ArrowRight size={12} /></button>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {recent.map((i, idx) => (
              <div key={i.id} onClick={() => setIncidentId(i.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: idx < recent.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}>
                <PriorityPill priority={i.priority} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fw-600" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</div>
                  <div className="text-xs muted mono">{i.incidentNumber} · {formatRelativeTime(i.updatedAt)}</div>
                </div>
                <IncidentStatusBadge status={i.status} />
              </div>
            ))}
            {recent.length === 0 && <div className="muted text-sm" style={{ padding: "12px 0" }}>Sin actividad reciente.</div>}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="field__label" style={{ marginBottom: 4 }}>Equipos problemáticos</div>
          <div className="text-xs muted" style={{ marginBottom: 16 }}>Más incidencias acumuladas</div>
          <div className="stack" style={{ gap: 12 }}>
            {topDevices.map((d, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, background: "var(--gray-100)", borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, color: "var(--gray-700)" }}>
                  <Laptop size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fw-600 text-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
                  {d.serial && <div className="text-xs muted mono">{d.serial}</div>}
                </div>
                <span className="badge badge--orange">{d.count} ticket{d.count !== 1 ? "s" : ""}</span>
              </div>
            ))}
            {topDevices.length === 0 && <div className="muted text-sm">Sin equipos registrados.</div>}
          </div>
        </div>
      </div>

      <IncidentDetailDrawer incidentId={incidentId} onClose={() => setIncidentId(null)} />
    </div>
  );
}
