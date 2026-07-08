import { db } from "@/lib/db";
import { dailyReviews } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface DailyReviewRow {
  entityType: string;
  entityId: string;
}

/** Todas las marcas "revisada" de una fecha (compartidas por el equipo). */
export async function getReviewsForDate(dateStr: string): Promise<DailyReviewRow[]> {
  const rows = await db
    .select({ entityType: dailyReviews.entityType, entityId: dailyReviews.entityId })
    .from(dailyReviews)
    .where(eq(dailyReviews.reviewDate, dateStr));
  return rows as DailyReviewRow[];
}
