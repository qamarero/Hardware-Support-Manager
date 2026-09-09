"use server";

import { db } from "@/lib/db";
import { reminders, reminderViews } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/get-session";
import {
  createReminderSchema,
  snoozeReminderSchema,
  reassignReminderSchema,
  corkNoteSchema,
  updateCorkNoteSchema,
} from "@/lib/validators/reminder";
import {
  getReminders,
  getCorkNotes,
  getUnseenCorkNoteCount,
  type ReminderFilters,
  type ReminderRow,
  type CorkNoteRow,
} from "@/server/queries/reminders";
import type { ActionResult } from "@/types";

export async function createReminder(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  const parsed = createReminderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const d = parsed.data;
  const [row] = await db
    .insert(reminders)
    .values({
      userId: d.userId || session.user.id,
      createdByUserId: session.user.id,
      entityType: d.entityType ?? null,
      entityId: d.entityId ?? null,
      title: d.title.trim(),
      note: d.note || null,
      dueAt: d.dueAt ?? null,
      recurrence: d.recurrence ?? "none",
    })
    .returning({ id: reminders.id });

  return { success: true, data: { id: row.id } };
}

/** Avanza una fecha según la recurrencia. */
function nextOccurrence(from: Date, recurrence: string): Date | null {
  const d = new Date(from);
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return d;
}

export async function completeReminder(id: string): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();
  const [current] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
  if (!current) return { success: false, error: "Recordatorio no encontrado" };

  await db
    .update(reminders)
    .set({ status: "hecho", completedAt: new Date() })
    .where(eq(reminders.id, id));

  // Si es recurrente, generar la siguiente ocurrencia (pendiente). Una nota
  // del corcho sin fecha no se repite: no hay desde dónde contar.
  const next = current.dueAt
    ? nextOccurrence(new Date(current.dueAt), current.recurrence)
    : null;
  if (next) {
    await db.insert(reminders).values({
      userId: current.userId,
      createdByUserId: current.createdByUserId,
      entityType: current.entityType,
      entityId: current.entityId,
      title: current.title,
      note: current.note,
      dueAt: next,
      recurrence: current.recurrence,
    });
  }

  return { success: true, data: { id } };
}

export async function reassignReminder(input: unknown): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();
  const parsed = reassignReminderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };
  const [row] = await db
    .update(reminders)
    .set({ userId: parsed.data.userId })
    .where(eq(reminders.id, parsed.data.id))
    .returning({ id: reminders.id });
  if (!row) return { success: false, error: "Recordatorio no encontrado" };
  return { success: true, data: { id: row.id } };
}

export async function snoozeReminder(input: unknown): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();
  const parsed = snoozeReminderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };
  const [row] = await db
    .update(reminders)
    .set({ dueAt: parsed.data.dueAt, status: "pendiente", completedAt: null })
    .where(eq(reminders.id, parsed.data.id))
    .returning({ id: reminders.id });
  if (!row) return { success: false, error: "Recordatorio no encontrado" };
  return { success: true, data: { id: row.id } };
}

export async function deleteReminder(id: string): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();
  const [row] = await db
    .update(reminders)
    .set({ status: "descartado" })
    .where(eq(reminders.id, id))
    .returning({ id: reminders.id });
  if (!row) return { success: false, error: "Recordatorio no encontrado" };
  return { success: true, data: { id: row.id } };
}

/** Recordatorios del usuario conectado (o filtros explícitos). */
export async function fetchReminders(filters?: Omit<ReminderFilters, "userId"> & { mine?: boolean }): Promise<ReminderRow[]> {
  const session = await getRequiredSession();
  const { mine, ...rest } = filters ?? {};
  return getReminders({ ...rest, userId: mine ? session.user.id : undefined });
}

/** Recordatorios pendientes ligados a una entidad (para la ficha). */
export async function fetchEntityReminders(entityType: "incident" | "rma", entityId: string): Promise<ReminderRow[]> {
  await getRequiredSession();
  return getReminders({ entityType, entityId, status: ["pendiente"] });
}

/* ─── Corcho ──────────────────────────────────────────────────────────────
 * Una nota del corcho es un recordatorio con `kind = "nota"`: sin fecha
 * obligatoria y con dueño opcional (null = para todo el equipo).
 * ------------------------------------------------------------------------ */

/** Notas pendientes del tablero (compartido), con el "visto" de quien mira. */
export async function fetchCorkNotes(): Promise<CorkNoteRow[]> {
  const session = await getRequiredSession();
  return getCorkNotes(session.user.id);
}

/** Notas que me tocan y aún no he visto — alerta "revisar el corcho". */
export async function fetchUnseenCorkNoteCount(): Promise<number> {
  const session = await getRequiredSession();
  return getUnseenCorkNoteCount(session.user.id);
}

export async function createCorkNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  const parsed = corkNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const [row] = await db
    .insert(reminders)
    .values({
      kind: "nota",
      color: d.color,
      userId: d.userId ?? null,
      createdByUserId: session.user.id,
      entityType: d.entityType ?? null,
      entityId: d.entityId ?? null,
      title: d.title.trim(),
      note: d.note || null,
      dueAt: d.dueAt ?? null,
    })
    .returning({ id: reminders.id });

  return { success: true, data: { id: row.id } };
}

export async function updateCorkNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();
  const parsed = updateCorkNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const [row] = await db
    .update(reminders)
    .set({
      color: d.color,
      userId: d.userId ?? null,
      entityType: d.entityType ?? null,
      entityId: d.entityId ?? null,
      title: d.title.trim(),
      note: d.note || null,
      dueAt: d.dueAt ?? null,
    })
    .where(and(eq(reminders.id, d.id), eq(reminders.kind, "nota")))
    .returning({ id: reminders.id });

  if (!row) return { success: false, error: "Nota no encontrada" };
  return { success: true, data: { id: row.id } };
}

/**
 * Marca la nota como vista POR MÍ. No la quita del tablero ni la da por hecha:
 * solo deja de contar en mi alerta de Mi día.
 */
export async function markCorkNoteSeen(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  await db
    .insert(reminderViews)
    .values({ reminderId: id, userId: session.user.id })
    .onConflictDoNothing();
  return { success: true, data: { id } };
}

/** Deshace el "visto" — vuelve a aparecer en mi alerta. */
export async function unmarkCorkNoteSeen(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  await db
    .delete(reminderViews)
    .where(and(eq(reminderViews.reminderId, id), eq(reminderViews.userId, session.user.id)));
  return { success: true, data: { id } };
}

/**
 * Marca o desmarca una nota como hecha. A diferencia de `completeReminder`,
 * esto es REVERSIBLE y no la quita del corcho: se pinta tachada y se puede
 * volver atrás. Quitarla del tablero es cosa de `deleteReminder`.
 */
export async function setCorkNoteDone(
  id: string,
  done: boolean
): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();

  const [row] = await db
    .update(reminders)
    .set({
      status: done ? "hecho" : "pendiente",
      completedAt: done ? new Date() : null,
    })
    .where(and(eq(reminders.id, id), eq(reminders.kind, "nota")))
    .returning({ id: reminders.id });

  if (!row) return { success: false, error: "Nota no encontrada" };
  return { success: true, data: { id: row.id } };
}
