"use server";

import { db } from "@/lib/db";
import { rmaMetricReviews, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/get-session";
import { revalidatePath } from "next/cache";

export interface MetricReviewRow {
  metricKey: string;
  status: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  comment: string | null;
}

/** Anotaciones del reporte (semáforo/responsable/comentario) de una semana. */
export async function getMetricReviews(weekStart: string): Promise<MetricReviewRow[]> {
  await getRequiredSession();
  return db
    .select({
      metricKey: rmaMetricReviews.metricKey,
      status: rmaMetricReviews.status,
      ownerUserId: rmaMetricReviews.ownerUserId,
      ownerName: users.name,
      comment: rmaMetricReviews.comment,
    })
    .from(rmaMetricReviews)
    .leftJoin(users, eq(rmaMetricReviews.ownerUserId, users.id))
    .where(eq(rmaMetricReviews.weekStart, weekStart));
}

/**
 * Crea o actualiza (upsert por metric_key + week_start) la anotación de una
 * métrica en una semana. El cliente envía el trío completo (status, owner,
 * comment) para no perder campos no editados.
 */
export async function upsertMetricReview(input: {
  metricKey: string;
  weekStart: string;
  status?: string | null;
  ownerUserId?: string | null;
  comment?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  await getRequiredSession();

  if (!input.metricKey || !input.weekStart) {
    return { success: false, error: "Faltan metricKey/weekStart" };
  }

  try {
    await db
      .insert(rmaMetricReviews)
      .values({
        metricKey: input.metricKey,
        weekStart: input.weekStart,
        status: input.status ?? null,
        ownerUserId: input.ownerUserId ?? null,
        comment: input.comment ?? null,
      })
      .onConflictDoUpdate({
        target: [rmaMetricReviews.metricKey, rmaMetricReviews.weekStart],
        set: {
          status: input.status ?? null,
          ownerUserId: input.ownerUserId ?? null,
          comment: input.comment ?? null,
          updatedAt: new Date(),
        },
      });
    revalidatePath("/metricas");
    return { success: true };
  } catch (err) {
    console.error("upsertMetricReview error:", err);
    return { success: false, error: "No se pudo guardar la anotación" };
  }
}
