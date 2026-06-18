"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Check, Loader2, Plus } from "lucide-react";
import { Field } from "@/components/proto/drawer";
import { fetchEntityReminders, createReminder, completeReminder } from "@/server/actions/reminders";
import { formatDateTime } from "@/lib/utils/date-format";

interface Props {
  entityType: "incident" | "rma";
  entityId: string;
  defaultTitle?: string;
}

function presetDate(kind: "manana" | "2d" | "1w"): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (kind === "manana") d.setDate(d.getDate() + 1);
  if (kind === "2d") d.setDate(d.getDate() + 2);
  if (kind === "1w") d.setDate(d.getDate() + 7);
  return d;
}

// Date → valor para <input type="datetime-local"> en hora local.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderSection({ entityType, entityId, defaultTitle }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState<Date>(() => presetDate("manana"));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["reminders", "entity", entityType, entityId],
    queryFn: () => fetchEntityReminders(entityType, entityId),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["reminders", "entity", entityType, entityId] });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  const createM = useMutation({
    mutationFn: () =>
      createReminder({
        title: title.trim() || defaultTitle || "Seguimiento",
        note,
        dueAt: due.toISOString(),
        entityType,
        entityId,
      }),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Recordatorio creado");
      setAdding(false); setTitle(""); setNote(""); setDue(presetDate("manana"));
      invalidate();
    },
    onError: () => toast.error("Error al crear el recordatorio"),
  });

  const completeM = useMutation({
    mutationFn: (id: string) => completeReminder(id),
    onSuccess: (r) => { if (!r.success) { toast.error(r.error); return; } invalidate(); },
    onError: () => toast.error("Error al completar"),
  });

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="field__label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Bell size={13} /> Recordatorios
        </div>
        {!adding && (
          <button className="btn btn--outline btn--sm" onClick={() => setAdding(true)}>
            <Plus size={13} /> Recordar seguimiento
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          {items.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--gray-50)", borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm fw-600" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                <div className="text-xs muted">{formatDateTime(r.dueAt)}{r.note ? ` · ${r.note}` : ""}</div>
              </div>
              <button className="btn btn--ghost btn--sm" title="Marcar hecho" onClick={() => completeM.mutate(r.id)} disabled={completeM.isPending}>
                <Check size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div className="muted text-xs">Cargando…</div>}

      {adding && (
        <div className="card" style={{ padding: 14 }}>
          <div className="stack" style={{ gap: 12 }}>
            <Field label="Recordarme">
              <input className="input" placeholder={defaultTitle ?? "Ej. Llamar al cliente para confirmar"} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </Field>
            <div>
              <div className="field__label" style={{ marginBottom: 6 }}>Cuándo</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button className="chip" onClick={() => setDue(presetDate("manana"))}>Mañana</button>
                <button className="chip" onClick={() => setDue(presetDate("2d"))}>+2 días</button>
                <button className="chip" onClick={() => setDue(presetDate("1w"))}>+1 semana</button>
                <input
                  className="input"
                  type="datetime-local"
                  style={{ width: "auto" }}
                  value={toLocalInput(due)}
                  onChange={(e) => { if (e.target.value) setDue(new Date(e.target.value)); }}
                />
              </div>
              <div className="text-xs muted" style={{ marginTop: 6 }}>Programado: {formatDateTime(due)}</div>
            </div>
            <Field label="Nota (opcional)">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setAdding(false)}>Cancelar</button>
              <button className="btn btn--primary btn--sm" onClick={() => createM.mutate()} disabled={createM.isPending}>
                {createM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Crear recordatorio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
