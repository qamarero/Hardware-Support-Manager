import { db } from "@/lib/db";
import { reminders, incidents, rmas } from "@/lib/db/schema";
import { and, eq, lte, asc, inArray, getTableColumns, sql } from "drizzle-orm";

export type ReminderStatus = "pendiente" | "hecho" | "descartado";

export type ReminderRow = typeof reminders.$inferSelect & {
  entityNumber: string | null;
  entityTitle: string | null;
};

export interface ReminderFilters {
  userId?: string;
  status?: ReminderStatus[];
  entityType?: "incident" | "rma";
  entityId?: string;
  dueBefore?: Date;
}

export async function getReminders(filters: ReminderFilters): Promise<ReminderRow[]> {
  const conds = [];
  if (filters.userId) conds.push(eq(reminders.userId, filters.userId));
  if (filters.status?.length) conds.push(inArray(reminders.status, filters.status));
  if (filters.entityType) conds.push(eq(reminders.entityType, filters.entityType));
  if (filters.entityId) conds.push(eq(reminders.entityId, filters.entityId));
  if (filters.dueBefore) conds.push(lte(reminders.dueAt, filters.dueBefore));
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
