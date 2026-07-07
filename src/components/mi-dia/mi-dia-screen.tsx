"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Bell, Check, Clock, Loader2, Plus, Inbox, AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
import { fetchIncidents, fetchUsersForSelect } from "@/server/actions/incidents";
import { fetchReminders, completeReminder, snoozeReminder, createReminder, reassignReminder } from "@/server/actions/reminders";
import { IncidentStatusBadge, PriorityPill, SlaBar, slaProgress } from "@/components/proto/badges";
import { useAlertBadges } from "@/components/layout/sidebar-badges";
import { IncidentDetailDrawer } from "@/components/incidents-v2/incident-detail-drawer";
import { RmaDetailDrawer } from "@/components/rmas-v2/rma-detail-drawer";
import { PAUSED_INCIDENT_STATES, CLOSED_INCIDENT_STATUSES } from "@/lib/constants/statuses";
import { formatDateTime } from "@/lib/utils/date-format";
import type { ReminderRow } from "@/server/queries/reminders";
import type { IncidentRow } from "@/server/queries/incidents";

const FOLLOWUP_DAYS = 2; // esperas con >= 2 días sin movimiento → "toca seguir"

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }
function daysSince(date: Date | string) { return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000); }

export function MiDiaScreen() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const meId = (session?.user as { id?: string } | undefined)?.id;
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [rmaId, setRmaId] = useState<string | null>(null);
  const [addingReminder, setAddingReminder] = useState(false);

  const { data: badges } = useAlertBadges();

  const { data: remindersData = [], isLoading: loadingR } = useQuery({
    queryKey: ["reminders", "mine"],
    queryFn: () => fetchReminders({ mine: true, status: ["pendiente"] }),
  });

  const { data: incData, isLoading: loadingI } = useQuery({
    queryKey: ["incidents", "mine", meId],
    queryFn: () => fetchIncidents({ page: 1, pageSize: 500, sortBy: "updatedAt", sortOrder: "desc", filters: { assignedUserId: [meId!] } }),
    enabled: !!meId,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
  });

  const myIncidents: IncidentRow[] = useMemo(() => incData?.data ?? [], [incData]);

  const { porAtender, esperas, slaRiesgo } = useMemo(() => {
    const closed = CLOSED_INCIDENT_STATUSES as readonly string[];
    const paused = PAUSED_INCIDENT_STATES as readonly string[];
    const open = myIncidents.filter((i) => !closed.includes(i.status));
    const atender = open.filter((i) => !paused.includes(i.status)).sort((a, b) => slaProgress(b).pct - slaProgress(a).pct);
    const esp = open
      .filter((i) => paused.includes(i.status) && daysSince(i.stateChangedAt) >= FOLLOWUP_DAYS)
      .sort((a, b) => daysSince(b.stateChangedAt) - daysSince(a.stateChangedAt));
    const risk = atender.filter((i) => ["bad", "warn"].includes(slaProgress(i).level));
    return { porAtender: atender, esperas: esp, slaRiesgo: risk };
  }, [myIncidents]);

  const { vencidos, hoy, proximos } = useMemo(() => {
    const sot = startOfToday().getTime();
    const eot = endOfToday().getTime();
    const v: ReminderRow[] = [], h: ReminderRow[] = [], p: ReminderRow[] = [];
    for (const r of remindersData) {
      const t = new Date(r.dueAt).getTime();
      if (t < sot) v.push(r);
      else if (t <= eot) h.push(r);
      else p.push(r);
    }
    return { vencidos: v, hoy: h, proximos: p };
  }, [remindersData]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }
  const completeM = useMutation({
    mutationFn: (r: ReminderRow) => completeReminder(r.id).then((res) => ({ res, r })),
    onSuccess: ({ res, r }) => {
      if (!res.success) { toast.error(res.error); return; }
      invalidate();
      // Deshacer: revertir a pendiente con su fecha original.
      toast.success("Recordatorio hecho", {
        action: {
          label: "Deshacer",
          onClick: async () => { await snoozeReminder({ id: r.id, dueAt: new Date(r.dueAt).toISOString() }); invalidate(); },
        },
      });
    },
  });
  const snoozeM = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) => snoozeReminder({ id, dueAt }),
    onSuccess: (r) => { if (!r.success) { toast.error(r.error); return; } toast.success("Recordatorio pospuesto"); invalidate(); },
  });
  const reassignM = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => reassignReminder({ id, userId }),
    onSuccess: (r) => { if (!r.success) { toast.error(r.error); return; } toast.success("Recordatorio delegado"); invalidate(); },
    onError: () => toast.error("Error al delegar"),
  });

  function openReminderEntity(r: ReminderRow) {
    if (r.entityType === "incident" && r.entityId) setIncidentId(r.entityId);
    else if (r.entityType === "rma" && r.entityId) setRmaId(r.entityId);
  }

  const greeting = session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : "";
  const intercomPending = badges?.intercom ?? 0;
  const loading = loadingR || loadingI;

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Mi día{greeting}</h1>
        <p>Tu agenda: recordatorios, lo que tienes que atender y lo que se enfría</p>
      </div>

      {/* Pendiente de registrar (Intercom) */}
      {intercomPending > 0 && (
        <Link href="/intercom" className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--orange-50)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Inbox size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="fw-700 text-sm">{intercomPending} conversación{intercomPending !== 1 ? "es" : ""} pendiente{intercomPending !== 1 ? "s" : ""} de registrar</div>
            <div className="text-xs muted">En la Bandeja Intercom esperando que las pases a incidencia</div>
          </div>
          <ArrowRight size={16} style={{ color: "var(--fg-tertiary)" }} />
        </Link>
      )}

      {loading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando tu día…</span></div>
      ) : (
        <>
          {/* Recordatorios */}
          <Section
            title="Recordatorios"
            icon={<Bell size={15} />}
            count={vencidos.length + hoy.length}
            action={<button className="btn btn--outline btn--sm" onClick={() => setAddingReminder((v) => !v)}><Plus size={13} /> Nuevo</button>}
          >
            {addingReminder && <StandaloneReminderForm onDone={() => { setAddingReminder(false); invalidate(); }} />}
            {vencidos.length === 0 && hoy.length === 0 && proximos.length === 0 && !addingReminder && (
              <div className="muted text-sm" style={{ padding: "4px 2px" }}>Sin recordatorios. Crea uno o ponlos desde una ficha.</div>
            )}
            {vencidos.length > 0 && <SubLabel text="Vencidos" tone="bad" />}
            {vencidos.map((r) => <ReminderRowView key={r.id} r={r} overdue onComplete={() => completeM.mutate(r)} onSnooze={(dueAt) => snoozeM.mutate({ id: r.id, dueAt })} onReassign={(userId) => reassignM.mutate({ id: r.id, userId })} users={users} onOpen={() => openReminderEntity(r)} />)}
            {hoy.length > 0 && <SubLabel text="Hoy" tone="warn" />}
            {hoy.map((r) => <ReminderRowView key={r.id} r={r} onComplete={() => completeM.mutate(r)} onSnooze={(dueAt) => snoozeM.mutate({ id: r.id, dueAt })} onReassign={(userId) => reassignM.mutate({ id: r.id, userId })} users={users} onOpen={() => openReminderEntity(r)} />)}
            {proximos.length > 0 && <SubLabel text="Próximos" tone="muted" />}
            {proximos.map((r) => <ReminderRowView key={r.id} r={r} onComplete={() => completeM.mutate(r)} onSnooze={(dueAt) => snoozeM.mutate({ id: r.id, dueAt })} onReassign={(userId) => reassignM.mutate({ id: r.id, userId })} users={users} onOpen={() => openReminderEntity(r)} />)}
          </Section>

          {/* SLA en riesgo */}
          {slaRiesgo.length > 0 && (
            <Section title="SLA en riesgo" icon={<AlertTriangle size={15} />} count={slaRiesgo.length}>
              {slaRiesgo.map((i) => <IncidentRowView key={i.id} i={i} onOpen={() => setIncidentId(i.id)} />)}
            </Section>
          )}

          {/* Mis incidencias por atender */}
          <Section title="Por atender" icon={<CalendarClock size={15} />} count={porAtender.length}>
            {porAtender.length === 0 ? (
              <div className="muted text-sm" style={{ padding: "4px 2px" }}>Nada pendiente asignado a ti 🎉</div>
            ) : porAtender.map((i) => <IncidentRowView key={i.id} i={i} onOpen={() => setIncidentId(i.id)} />)}
          </Section>

          {/* Esperas que tocan seguir */}
          {esperas.length > 0 && (
            <Section title="Esperas que tocan seguir" icon={<Clock size={15} />} count={esperas.length}>
              {esperas.map((i) => (
                <IncidentRowView key={i.id} i={i} onOpen={() => setIncidentId(i.id)} suffix={<span className="muted text-xs">{daysSince(i.stateChangedAt)}d esperando</span>} />
              ))}
            </Section>
          )}
        </>
      )}

      <IncidentDetailDrawer incidentId={incidentId} onClose={() => setIncidentId(null)} />
      <RmaDetailDrawer rmaId={rmaId} onClose={() => setRmaId(null)} />
    </div>
  );
}

function Section({ title, icon, count, action, children }: { title: string; icon: React.ReactNode; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ color: "var(--primary)", display: "flex" }}>{icon}</span>
        <span className="fw-700" style={{ fontSize: 14 }}>{title}</span>
        {count !== undefined && count > 0 && <span className="chip__count">{count}</span>}
        <div style={{ flex: 1 }} />
        {action}
      </div>
      <div className="stack" style={{ gap: 8 }}>{children}</div>
    </div>
  );
}

function snoozePresets(): { label: string; get: () => string }[] {
  return [
    { label: "En 1 hora", get: () => { const d = new Date(); d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0); return d.toISOString(); } },
    { label: "Esta tarde (17:00)", get: () => { const d = new Date(); d.setHours(17, 0, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); return d.toISOString(); } },
    { label: "Mañana (9:00)", get: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString(); } },
    { label: "Próximo lunes (9:00)", get: () => { const d = new Date(); const add = ((1 - d.getDay() + 7) % 7) || 7; d.setDate(d.getDate() + add); d.setHours(9, 0, 0, 0); return d.toISOString(); } },
  ];
}

function SnoozeControl({ onSnooze }: { onSnooze: (dueAt: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn--ghost btn--sm" title="Posponer" onClick={() => setOpen((o) => !o)}><Clock size={14} /></button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-m)", boxShadow: "var(--shadow-elev)", padding: 4, width: 210 }}>
          {snoozePresets().map((p) => (
            <button key={p.label} type="button" onClick={() => { onSnooze(p.get()); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: "8px 10px", borderRadius: "var(--radius-s)", cursor: "pointer", fontSize: 13 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gray-50)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              {p.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, padding: "8px 10px" }}>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>Otra fecha</div>
            <input className="input" type="datetime-local" onChange={(e) => { if (e.target.value) { onSnooze(new Date(e.target.value).toISOString()); setOpen(false); } }} />
          </div>
        </div>
      )}
    </div>
  );
}

function SubLabel({ text, tone }: { text: string; tone: "bad" | "warn" | "muted" }) {
  const color = tone === "bad" ? "var(--danger)" : tone === "warn" ? "var(--amber-900, var(--warning))" : "var(--fg-tertiary)";
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color, marginTop: 4 }}>{text}</div>;
}

function ReminderRowView({ r, overdue, onComplete, onSnooze, onReassign, users, onOpen }: { r: ReminderRow; overdue?: boolean; onComplete: () => void; onSnooze: (dueAt: string) => void; onReassign: (userId: string) => void; users: { id: string; name: string }[]; onOpen: () => void }) {
  // Toda la fila abre la ficha vinculada (incidencia/RMA). Los recordatorios
  // sueltos (sin entidad) no navegan. Los controles cortan la propagación.
  const hasEntity = !!(r.entityType && r.entityId);
  return (
    <div
      role={hasEntity ? "button" : undefined}
      tabIndex={hasEntity ? 0 : undefined}
      onClick={hasEntity ? onOpen : undefined}
      onKeyDown={hasEntity ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      title={hasEntity ? "Abrir ficha vinculada" : undefined}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--gray-50)", borderRadius: 10, cursor: hasEntity ? "pointer" : "default" }}
      onMouseEnter={hasEntity ? (e) => { e.currentTarget.style.background = "var(--gray-100)"; } : undefined}
      onMouseLeave={hasEntity ? (e) => { e.currentTarget.style.background = "var(--gray-50)"; } : undefined}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-sm fw-600" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
        <div className="text-xs muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: overdue ? "var(--danger)" : undefined }}>{formatDateTime(r.dueAt)}</span>
          {r.entityNumber && <span className="mono" style={{ color: "var(--primary)" }}>· {r.entityNumber}</span>}
          {r.note && <span>· {r.note}</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
        {users.length > 0 && (
          <select
            className="select"
            style={{ width: "auto", fontSize: 12, padding: "4px 6px" }}
            value=""
            onChange={(e) => { if (e.target.value) onReassign(e.target.value); }}
            title="Delegar a otro técnico"
          >
            <option value="">Delegar…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <SnoozeControl onSnooze={onSnooze} />
        <button className="btn btn--ghost btn--sm" title="Marcar hecho" onClick={onComplete}><Check size={14} /></button>
      </div>
    </div>
  );
}

function IncidentRowView({ i, onOpen, suffix }: { i: IncidentRow; onOpen: () => void; suffix?: React.ReactNode }) {
  return (
    <button type="button" onClick={onOpen} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "#fff", cursor: "pointer" }}>
      <span className="id-cell" style={{ flexShrink: 0 }}>{i.incidentNumber}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-sm fw-600" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</div>
        <div className="text-xs muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.clientCompanyName ?? i.clientName ?? "—"}</div>
      </div>
      <PriorityPill priority={i.priority} />
      <div style={{ width: 90, flexShrink: 0 }}><SlaBar incident={i} /></div>
      <IncidentStatusBadge status={i.status} />
      {suffix}
    </button>
  );
}

function StandaloneReminderForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [due, setDue] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; });

  function toLocal(d: Date) { const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

  const createM = useMutation({
    mutationFn: () => createReminder({ title: title.trim() || "Recordatorio", note, dueAt: due.toISOString(), recurrence }),
    onSuccess: (r) => { if (!r.success) { toast.error(r.error); return; } toast.success("Recordatorio creado"); onDone(); },
    onError: () => toast.error("Error al crear el recordatorio"),
  });

  return (
    <div className="card" style={{ padding: 14, marginBottom: 4 }}>
      <div className="stack" style={{ gap: 10 }}>
        <input className="input" placeholder="Ej. Llamar al proveedor X" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" type="datetime-local" style={{ width: "auto" }} value={toLocal(due)} onChange={(e) => { if (e.target.value) setDue(new Date(e.target.value)); }} />
          <select className="select" style={{ width: "auto" }} value={recurrence} onChange={(e) => setRecurrence(e.target.value)} title="Repetir">
            <option value="none">No repetir</option>
            <option value="daily">Cada día</option>
            <option value="weekly">Cada semana</option>
            <option value="monthly">Cada mes</option>
          </select>
          <input className="input" placeholder="Nota (opcional)" style={{ flex: 1, minWidth: 160 }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn--primary btn--sm" onClick={() => createM.mutate()} disabled={createM.isPending}>
            {createM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Crear
          </button>
        </div>
      </div>
    </div>
  );
}
