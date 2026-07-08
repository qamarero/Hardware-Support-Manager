"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { dailyReviews } from "@/lib/db/schema";
import { getRequiredSession } from "@/lib/auth/get-session";
import { getReviewsForDate, type DailyReviewRow } from "@/server/queries/daily-reviews";
import type { ActionResult } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const markSchema = z.object({
  entityType: z.enum(["incident", "rma"]),
  entityId: z.string().uuid(),
  date: z.string().regex(DATE_RE),
});

/** Marcas de "revisada" de una fecha (equipo). `date` = YYYY-MM-DD local del cliente. */
export async function fetchTodayReviews(dateStr: string): Promise<DailyReviewRow[]> {
  await getRequiredSession();
  if (!DATE_RE.test(dateStr)) return [];
  return getReviewsForDate(dateStr);
}

/** Marca (compartida) una entidad como revisada ese día. Idempotente. */
export async function markReviewed(input: unknown): Promise<ActionResult<{ ok: true }>> {
  const session = await getRequiredSession();
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };
  const { entityType, entityId, date } = parsed.data;
  await db
    .insert(dailyReviews)
    .values({ entityType, entityId, reviewDate: date, reviewedByUserId: session.user.id })
    .onConflictDoNothing();
  return { success: true, data: { ok: true } };
}

/** Desmarca (para todo el equipo) una entidad ese día. */
export async function unmarkReviewed(input: unknown): Promise<ActionResult<{ ok: true }>> {
  await getRequiredSession();
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };
  const { entityType, entityId, date } = parsed.data;
  await db
    .delete(dailyReviews)
    .where(and(eq(dailyReviews.entityType, entityType), eq(dailyReviews.entityId, entityId), eq(dailyReviews.reviewDate, date)));
  return { success: true, data: { ok: true } };
}
