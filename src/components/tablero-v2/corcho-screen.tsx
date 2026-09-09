"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Loader2, StickyNote, Check, Pencil, Trash2, Eye, Link2, CalendarClock } from "lucide-react";
import { fetchUsersForSelect } from "@/server/actions/incidents";
import {
  fetchCorkNotes,
  createCorkNote,
  updateCorkNote,
  completeReminder,
  deleteReminder,
  markCorkNoteSeen,
} from "@/server/actions/reminders";
import { Avatar } from "@/components/proto/badges";
import { IncidentDetailDrawer } from "@/components/incidents-v2/incident-detail-drawer";
import { RmaDetailDrawer } from "@/components/rmas-v2/rma-detail-drawer";
import { corkPaper } from "@/lib/constants/corcho";
import { formatRelativeShort } from "@/lib/utils/date-format";
import { NoteEditor } from "./note-editor";
import type { CorkNoteRow } from "@/server/queries/reminders";

/** Rotación pequeña determinista por id (estable entre renders). */
function rotFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return (h % 700) / 100 - 3.5; // -3.5° .. +3.5°
}

type Scope = "todas" | "mias" | "sin-ver";

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

export function CorchoScreen() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const meId = (session?.user as { id?: string } | undefined)?.id;

  const [scope, setScope] = useState<Scope>("todas");
  const [groupByTech, setGroupByTech] = useState(false);
  const [editing, setEditing] = useState<CorkNoteRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [rmaId, setRmaId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["cork-notes"],
    queryFn: () => fetchCorkNotes(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["cork-notes"] });
    qc.invalidateQueries({ queryKey: ["cork-unseen"] });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  const doneM = useMutation({
    mutationFn: (id: string) => completeReminder(id),
    onSuccess: (r) => { if (!r.success) { toast.error(r.error); return; } toast.success("Nota hecha"); invalidate(); },
  });
  const discardM = useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: (r) => { if (!r.success) { toast.error(r.error); return; } toast.success("Nota quitada del corcho"); invalidate(); },
  });
  const seenM = useMutation({
    mutationFn: (id: string) => markCorkNoteSeen(id),
    onSuccess: () => invalidate(),
  });
  const saveM = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      input.id ? updateCorkNote(input) : createCorkNote(input),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success(editing ? "Nota guardada" : "Nota clavada en el corcho");
      setEditing(null);
      setCreating(false);
      invalidate();
    },
    onError: () => toast.error("No se pudo guardar la nota"),
  });

  /** Una nota "me toca" si es mía o va dirigida a todo el equipo. */
  function concernsMe(n: CorkNoteRow) {
    return !n.userId || n.userId === meId;
  }

  const visible = useMemo(() => {
    let arr = notes.slice();
    if (scope === "mias") arr = arr.filter(concernsMe);
    if (scope === "sin-ver") arr = arr.filter((n) => concernsMe(n) && !n.seenByMe);
    // Sin ver primero, luego vencidas, luego las más nuevas.
    const sot = startOfToday().getTime();
    return arr.sort((a, b) => {
      const unseen = Number(concernsMe(b) && !b.seenByMe) - Number(concernsMe(a) && !a.seenByMe);
      if (unseen) return unseen;
      const overdue =
        Number(!!b.dueAt && new Date(b.dueAt).getTime() < sot) -
        Number(!!a.dueAt && new Date(a.dueAt).getTime() < sot);
      if (overdue) return overdue;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, scope, meId]);

  const unseenMine = useMemo(
    () => notes.filter((n) => concernsMe(n) && !n.seenByMe).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, meId]
  );

  const zones = useMemo(() => {
    if (!groupByTech) return null;
    const byTech = users
      .map((u) => ({ key: u.id, label: u.name, items: visible.filter((n) => n.userId === u.id) }))
      .filter((z) => z.items.length);
    const all = { key: "todos", label: "Para todo el equipo", items: visible.filter((n) => !n.userId) };
    return [...(all.items.length ? [all] : []), ...byTech];
  }, [groupByTech, users, visible]);

  function openNoteEntity(n: CorkNoteRow) {
    if (n.entityType === "incident" && n.entityId) setIncidentId(n.entityId);
    else if (n.entityType === "rma" && n.entityId) setRmaId(n.entityId);
  }

  function openNote(n: CorkNoteRow) {
    if (concernsMe(n) && !n.seenByMe) seenM.mutate(n.id);
    setEditing(n);
  }

  const cardProps = {
    meId,
    onOpen: openNote,
    onEntity: openNoteEntity,
    onDone: (id: string) => doneM.mutate(id),
    onDiscard: (id: string) => discardM.mutate(id),
  };

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Corcho</h1>
        <p>Notas del equipo · sueltas o ligadas a una incidencia o un RMA</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="seg">
          <button className={scope === "todas" ? "is-active" : ""} onClick={() => setScope("todas")}>Todas</button>
          <button className={scope === "mias" ? "is-active" : ""} onClick={() => setScope("mias")}>Las mías</button>
          <button className={scope === "sin-ver" ? "is-active" : ""} onClick={() => setScope("sin-ver")}>
            Sin ver{unseenMine > 0 ? ` (${unseenMine})` : ""}
          </button>
        </div>
        <button className={`chip ${groupByTech ? "is-active" : ""}`} onClick={() => setGroupByTech(!groupByTech)}>
          {groupByTech ? "Agrupadas por técnico" : "Agrupar por técnico"}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setCreating(true); }}>
          <Plus size={14} /> Nueva nota
        </button>
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando el corcho…</span></div>
      ) : !visible.length ? (
        <div className="cork">
          <div className="cork__empty">
            <StickyNote size={28} color="rgba(255,255,255,0.75)" />
            <div className="fw-700" style={{ marginTop: 8, fontSize: 15 }}>
              {scope === "todas" ? "El corcho está vacío" : "Nada por aquí con ese filtro"}
            </div>
            <div className="text-sm" style={{ opacity: 0.85 }}>
              {scope === "todas" ? "Clava una nota para ti o para otro técnico." : "Prueba con «Todas»."}
            </div>
          </div>
        </div>
      ) : zones ? (
        <div className="cork">
          {zones.map((zone) => (
            <div key={zone.key} className="cork__zone">
              <div className="cork__zone-label">
                {zone.label}
                <span className="cork__zone-count">{zone.items.length}</span>
              </div>
              <div className="cork__notes">
                {zone.items.map((n) => <NoteCard key={n.id} note={n} {...cardProps} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cork cork--flat">
          <div className="cork__notes">
            {visible.map((n) => <NoteCard key={n.id} note={n} {...cardProps} />)}
          </div>
        </div>
      )}

      {/* Se monta al abrir y se desmonta al cerrar: así el formulario nace
          limpio (o con la nota que toca) sin depender de un efecto. */}
      {(creating || editing) && (
        <NoteEditor
          key={editing?.id ?? "nueva"}
          open
          note={editing}
          users={users}
          saving={saveM.isPending}
          onSave={(values) => saveM.mutate(values)}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}

      <IncidentDetailDrawer incidentId={incidentId} onClose={() => setIncidentId(null)} />
      <RmaDetailDrawer rmaId={rmaId} onClose={() => setRmaId(null)} />
    </div>
  );
}

function NoteCard({
  note, meId, onOpen, onEntity, onDone, onDiscard,
}: {
  note: CorkNoteRow;
  meId?: string;
  onOpen: (n: CorkNoteRow) => void;
  onEntity: (n: CorkNoteRow) => void;
  onDone: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const paper = corkPaper(note.color);
  const rot = rotFor(note.id);
  const concernsMe = !note.userId || note.userId === meId;
  const unseen = concernsMe && !note.seenByMe;
  const overdue = !!note.dueAt && new Date(note.dueAt).getTime() < startOfToday().getTime();

  return (
    <article
      className={`postit postit--note ${!unseen ? "postit--seen" : ""}`}
      style={{
        ["--rot" as string]: `${rot}deg`,
        background: `linear-gradient(160deg, ${paper.bg} 0%, ${paper.edge} 100%)`,
        color: paper.ink,
      }}
    >
      <span className="postit__pin" aria-hidden="true" />
      <button
        type="button"
        className="postit__open"
        onClick={() => onOpen(note)}
        aria-label={`Abrir nota: ${note.title}`}
      />

      {unseen && <span className="postit__flag postit__flag--new"><Eye size={11} /> Sin ver</span>}
      {!unseen && overdue && <span className="postit__flag postit__flag--due"><CalendarClock size={11} /> Vencida</span>}

      <div className="postit__actions">
        <button type="button" className="postit__act" title="Editar" onClick={() => onOpen(note)}>
          <Pencil size={13} />
        </button>
        <button type="button" className="postit__act" title="Dar por hecha" onClick={() => onDone(note.id)}>
          <Check size={14} />
        </button>
        <button type="button" className="postit__act postit__act--danger" title="Quitar del corcho" onClick={() => onDiscard(note.id)}>
          <Trash2 size={13} />
        </button>
      </div>

      <div className="postit__title">{note.title}</div>
      {note.note && <div className="postit__body">{note.note}</div>}

      <div className="postit__meta">
        {note.entityNumber && (
          <button type="button" className="postit__link" onClick={() => onEntity(note)} title="Abrir la ficha vinculada">
            <Link2 size={12} /> {note.entityNumber}
          </button>
        )}
      </div>

      <div className="postit__foot">
        {note.assignedUserName ? (
          <span className="postit__audience" title={note.assignedUserName}>
            <Avatar name={note.assignedUserName} src={note.assignedUserAvatar} size="sm" />
            <span>{note.assignedUserName.split(" ")[0]}</span>
          </span>
        ) : (
          <span className="postit__audience postit__audience--all">Para todos</span>
        )}
        <span className="postit__date" title={note.createdByName ? `Escrita por ${note.createdByName}` : undefined}>
          {note.dueAt ? new Date(note.dueAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : formatRelativeShort(note.createdAt)}
        </span>
      </div>
    </article>
  );
}
