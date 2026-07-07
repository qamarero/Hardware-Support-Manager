"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { eventLogs } from "@/lib/db/schema";
import { getRequiredSession } from "@/lib/auth/get-session";
import type { ActionResult } from "@/types";

/**
 * Registro ligero de "he contactado al cliente" para el seguimiento diario.
 * Se guarda como evento en `event_logs` (action:"contacted"), auditable y en el
 * timeline de la ficha. NO sincroniza a Intercom (es una marca interna del
 * operador, a diferencia de addManualNote). `action` es varchar libre → sin
 * migración.
 */
const logContactSchema = z.object({
  entityType: z.enum(["incident", "rma"]),
  entityId: z.string().uuid(),
  channel: z.enum(["intercom", "telefono", "email", "otro"]).optional(),
  note: z.string().max(500).optional(),
});

export async function logContact(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = logContactSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { entityType, entityId, channel, note } = parsed.data;

  const [log] = await db
    .insert(eventLogs)
    .values({
      entityType,
      entityId,
      action: "contacted",
      userId: session.user.id,
      details: { channel: channel ?? null, note: note ?? null },
    })
    .returning({ id: eventLogs.id });

  const basePath = entityType === "incident" ? "/incidents" : "/rmas";
  revalidatePath(`${basePath}/${entityId}`);
  revalidatePath("/mi-dia");

  return { success: true, data: { id: log.id } };
}
