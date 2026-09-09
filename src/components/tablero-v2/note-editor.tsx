"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { Combobox, type ComboOption } from "@/components/proto/combobox";
import { fetchIncidents } from "@/server/actions/incidents";
import { fetchRmas } from "@/server/actions/rmas";
import { CORK_COLORS, CORK_COLOR_LABELS, CORK_COLOR_PAPER, DEFAULT_CORK_COLOR, type CorkColor } from "@/lib/constants/corcho";
import type { CorkNoteRow } from "@/server/queries/reminders";

type LinkType = "" | "incident" | "rma";

interface NoteEditorProps {
  /**
   * El editor se MONTA al abrirse (ver CorchoScreen): el estado arranca de
   * `note` en el propio useState, no en un efecto. Con un efecto, el
   * formulario mostraba los datos de la nota anterior hasta que corría, y
   * al escribir rápido el texto se concatenaba con el viejo.
   */
  open: boolean;
  /** null = crear una nota nueva. */
  note: CorkNoteRow | null;
  users: { id: string; name: string }[];
  saving: boolean;
  onSave: (values: Record<string, unknown>) => void;
  onClose: () => void;
}

/** Fecha ISO -> valor de un <input type="date"> en hora local. */
function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  const x = new Date(d);
  const off = x.getTimezoneOffset();
  return new Date(x.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function NoteEditor({ open, note, users, saving, onSave, onClose }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.note ?? "");
  const [color, setColor] = useState<CorkColor>((note?.color as CorkColor) ?? DEFAULT_CORK_COLOR);
  const [userId, setUserId] = useState(note?.userId ?? "");
  const [dueAt, setDueAt] = useState(toDateInput(note?.dueAt ?? null));
  const [linkType, setLinkType] = useState<LinkType>((note?.entityType as LinkType) ?? "");
  const [linkId, setLinkId] = useState(note?.entityId ?? "");
  const [error, setError] = useState<string | null>(null);

  // Las listas para vincular solo se piden cuando hacen falta.
  const { data: incData } = useQuery({
    queryKey: ["incidents", "link-picker"],
    queryFn: () => fetchIncidents({ page: 1, pageSize: 200, sortBy: "createdAt", sortOrder: "desc" }),
    enabled: open && linkType === "incident",
  });
  const { data: rmaData } = useQuery({
    queryKey: ["rmas", "link-picker"],
    queryFn: () => fetchRmas({ page: 1, pageSize: 200, sortBy: "createdAt", sortOrder: "desc" }),
    enabled: open && linkType === "rma",
  });

  const linkOptions: ComboOption[] = useMemo(() => {
    if (linkType === "incident") {
      return (incData?.data ?? []).map((i) => ({ id: i.id, name: i.incidentNumber, hint: i.title }));
    }
    if (linkType === "rma") {
      return (rmaData?.data ?? []).map((r) => ({
        id: r.id,
        name: r.rmaNumber,
        hint: [r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || null,
      }));
    }
    return [];
  }, [linkType, incData, rmaData]);

  function submit() {
    if (!title.trim()) { setError("Escribe algo en la nota"); return; }
    if (linkType && !linkId) { setError("Elige la incidencia o el RMA a vincular"); return; }
    setError(null);
    onSave({
      ...(note ? { id: note.id } : {}),
      title: title.trim(),
      note: body.trim(),
      color,
      userId: userId || null,
      dueAt: dueAt ? new Date(`${dueAt}T09:00:00`) : null,
      entityType: linkType || null,
      entityId: linkType ? linkId : null,
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={note ? "Editar nota" : "Nueva nota"}
      subtitle={note?.createdByName ? `Escrita por ${note.createdByName}` : "Se clava en el corcho del equipo"}
      width={560}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn--outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {note ? "Guardar" : "Clavar en el corcho"}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Nota">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="P. ej. Llamar al proveedor por la recogida"
            autoFocus
          />
        </Field>

        <Field label="Detalle" hint="Opcional">
          <textarea
            className="textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Lo que haga falta recordar"
          />
        </Field>

        <Field label="Color">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CORK_COLORS.map((c) => {
              const paper = CORK_COLOR_PAPER[c];
              const active = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  title={CORK_COLOR_LABELS[c]}
                  aria-label={CORK_COLOR_LABELS[c]}
                  aria-pressed={active}
                  onClick={() => setColor(c)}
                  style={{
                    width: 34, height: 34, borderRadius: 8, cursor: "pointer",
                    background: `linear-gradient(160deg, ${paper.bg} 0%, ${paper.edge} 100%)`,
                    border: active ? "2px solid var(--gray-900)" : "1px solid var(--border)",
                    display: "grid", placeItems: "center", color: paper.ink,
                  }}
                >
                  {active && <Check size={15} />}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Para quién" hint="Sin elegir a nadie, la nota es para todo el equipo y alerta a todos.">
          <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Para todo el equipo</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>

        <Field label="Fecha" hint="Opcional. Con fecha, la nota también sale en tus recordatorios de Mi día.">
          <input className="input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>

        <Field label="Vincular a">
          <select
            className="select"
            value={linkType}
            onChange={(e) => { setLinkType(e.target.value as LinkType); setLinkId(""); }}
          >
            <option value="">Nota suelta (sin vínculo)</option>
            <option value="incident">Una incidencia</option>
            <option value="rma">Un RMA</option>
          </select>
        </Field>

        {linkType && (
          <Field label={linkType === "incident" ? "Incidencia" : "RMA"}>
            <Combobox
              options={linkOptions}
              value={linkId}
              onChange={setLinkId}
              placeholder={linkOptions.length ? "Buscar por número…" : "Cargando…"}
              emptyLabel="Sin resultados"
            />
          </Field>
        )}

        {error && <div className="text-sm" style={{ color: "var(--red-500)" }}>{error}</div>}
      </div>
    </Drawer>
  );
}
