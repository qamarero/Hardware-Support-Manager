"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventLogs, incidents, rmas, users } from "@/lib/db/schema";
import { getRequiredSession } from "@/lib/auth/get-session";
import { addNoteSchema } from "@/lib/validators/note";
import { syncManualNote } from "@/lib/intercom/sync";
import type { ActionResult } from "@/types";

export async function addManualNote(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { entityType, entityId, body } = parsed.data;

  const [log] = await db
    .insert(eventLogs)
    .values({
      entityType,
      entityId,
      action: "note",
      userId: session.user.id,
      details: { body },
    })
    .returning({ id: eventLogs.id });

  // Fire-and-forget sync to Intercom — never block the user.
  void (async () => {
    try {
      const [author] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
      const authorName = author?.name ?? "Técnico";

      if (entityType === "incident") {
        const [inc] = await db
          .select({
            intercomUrl: incidents.intercomUrl,
            intercomEscalationId: incidents.intercomEscalationId,
            incidentNumber: incidents.incidentNumber,
          })
          .from(incidents)
          .where(eq(incidents.id, entityId))
          .limit(1);
        if (inc && (inc.intercomUrl || inc.intercomEscalationId)) {
          await syncManualNote({
            intercomUrl: inc.intercomUrl,
            intercomEscalationId: inc.intercomEscalationId,
            entityType: "incident",
            entityNumber: inc.incidentNumber,
            authorName,
            body,
          });
        }
      } else {
        const [rma] = await db
          .select({
            clientIntercomUrl: rmas.clientIntercomUrl,
            rmaNumber: rmas.rmaNumber,
          })
          .from(rmas)
          .where(eq(rmas.id, entityId))
          .limit(1);
        if (rma?.clientIntercomUrl) {
          await syncManualNote({
            intercomUrl: rma.clientIntercomUrl,
            intercomEscalationId: null,
            entityType: "rma",
            entityNumber: rma.rmaNumber,
            authorName,
            body,
          });
        }
      }
    } catch (err) {
      console.error("[notes] Error sincronizando nota a Intercom:", err);
    }
  })();

  const basePath = entityType === "incident" ? "/incidents" : "/rmas";
  revalidatePath(`${basePath}/${entityId}`);

  return { success: true, data: { id: log.id } };
}

/**
 * Comentario INTERNO (compañeros de soporte / pestaña Consulta). Queda en la
 * timeline (event_logs, action "comment") pero NO se sincroniza a Intercom.
 * Permitido para cualquier rol autenticado, incluido "viewer" — es la única
 * escritura que puede hacer un Visor.
 */
export async function addComment(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { entityType, entityId, body } = parsed.data;

  const [log] = await db
    .insert(eventLogs)
    .values({
      entityType,
      entityId,
      action: "comment",
      userId: session.user.id,
      details: { body },
    })
    .returning({ id: eventLogs.id });

  const basePath = entityType === "incident" ? "/incidents" : "/rmas";
  revalidatePath(`${basePath}/${entityId}`);
  revalidatePath("/consulta");

  return { success: true, data: { id: log.id } };
}
