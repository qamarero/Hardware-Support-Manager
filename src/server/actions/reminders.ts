"use server";

import { db } from "@/lib/db";
import { reminders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/get-session";
import { createReminderSchema, snoozeReminderSchema } from "@/lib/validators/reminder";
import { getReminders, type ReminderFilters, type ReminderRow } from "@/server/queries/reminders";
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
      dueAt: d.dueAt,
    })
    .returning({ id: reminders.id });

  return { success: true, data: { id: row.id } };
}

export async function completeReminder(id: string): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();
  const [row] = await db
    .update(reminders)
    .set({ status: "hecho", completedAt: new Date() })
    .where(eq(reminders.id, id))
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
