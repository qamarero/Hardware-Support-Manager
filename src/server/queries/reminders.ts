import { db } from "@/lib/db";
import { reminders, reminderViews, incidents, rmas, users } from "@/lib/db/schema";
import { and, eq, lte, asc, desc, or, isNull, inArray, getTableColumns, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export type ReminderStatus = "pendiente" | "hecho" | "descartado";

export type ReminderRow = typeof reminders.$inferSelect & {
  entityNumber: string | null;
  entityTitle: string | null;
};

/** Nota del corcho: recordatorio + quién la escribió, para quién y si la he visto. */
export type CorkNoteRow = ReminderRow & {
  assignedUserName: string | null;
  assignedUserAvatar: string | null;
  createdByName: string | null;
  seenByMe: boolean;
};

export interface ReminderFilters {
  userId?: string;
  status?: ReminderStatus[];
  entityType?: "incident" | "rma";
  entityId?: string;
  dueBefore?: Date;
  kind?: "nota" | "seguimiento";
}

export async function getReminders(filters: ReminderFilters): Promise<ReminderRow[]> {
  const conds = [];
  if (filters.userId) conds.push(eq(reminders.userId, filters.userId));
  if (filters.status?.length) conds.push(inArray(reminders.status, filters.status));
  if (filters.entityType) conds.push(eq(reminders.entityType, filters.entityType));
  if (filters.entityId) conds.push(eq(reminders.entityId, filters.entityId));
  if (filters.dueBefore) conds.push(lte(reminders.dueAt, filters.dueBefore));
  if (filters.kind) conds.push(eq(reminders.kind, filters.kind));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      ...getTableColumns(reminders),
      entityNumber: sql<string | null>`coalesce(${incidents.incidentNumber}, ${rmas.rmaNumber})`,
      entityTitle: incidents.title,
    })
    .from(reminders)
    .leftJoin(incidents, and(eq(reminders.entityType, "incident"), eq(reminders.entityId, incidents.id)))
    .leftJoin(rmas, and(eq(reminders.entityType, "rma"), eq(reminders.entityId, rmas.id)))
    .where(where)
    .orderBy(asc(reminders.dueAt));
}

/**
 * Notas pendientes del corcho. El tablero es COMPARTIDO: devuelve todas las
 * notas, con el "visto" resuelto para quien mira (`viewerId`).
 */
export async function getCorkNotes(viewerId: string): Promise<CorkNoteRow[]> {
  const assignee = alias(users, "assignee");
  const author = alias(users, "author");
  const myView = alias(reminderViews, "my_view");

  return db
    .select({
      ...getTableColumns(reminders),
      entityNumber: sql<string | null>`coalesce(${incidents.incidentNumber}, ${rmas.rmaNumber})`,
      entityTitle: incidents.title,
      assignedUserName: assignee.name,
      assignedUserAvatar: assignee.avatarUrl,
      createdByName: author.name,
      seenByMe: sql<boolean>`(${myView.id} is not null)`,
    })
    .from(reminders)
    .leftJoin(incidents, and(eq(reminders.entityType, "incident"), eq(reminders.entityId, incidents.id)))
    .leftJoin(rmas, and(eq(reminders.entityType, "rma"), eq(reminders.entityId, rmas.id)))
    .leftJoin(assignee, eq(reminders.userId, assignee.id))
    .leftJoin(author, eq(reminders.createdByUserId, author.id))
    .leftJoin(myView, and(eq(myView.reminderId, reminders.id), eq(myView.userId, viewerId)))
    .where(and(eq(reminders.kind, "nota"), eq(reminders.status, "pendiente")))
    .orderBy(desc(reminders.createdAt));
}

/**
 * Cuántas notas del corcho tiene pendientes de ver esta persona: las suyas y
 * las dirigidas a todo el equipo que aún no ha marcado como vistas.
 * Alimenta la alerta "revisar el corcho" de Mi día.
 */
export async function getUnseenCorkNoteCount(viewerId: string): Promise<number> {
  const myView = alias(reminderViews, "my_view");

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reminders)
    .leftJoin(myView, and(eq(myView.reminderId, reminders.id), eq(myView.userId, viewerId)))
    .where(
      and(
        eq(reminders.kind, "nota"),
        eq(reminders.status, "pendiente"),
        or(eq(reminders.userId, viewerId), isNull(reminders.userId)),
        isNull(myView.id)
      )
    );

  return row?.count ?? 0;
}
