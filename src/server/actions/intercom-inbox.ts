"use server";

import { db } from "@/lib/db";
import { intercomInbox, incidents, eventLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import {
  convertToIncidentSchema,
  dismissInboxItemSchema,
} from "@/lib/validators/intercom-inbox";
import { generateSequentialId } from "@/lib/utils/id-generator";
import {
  getIntercomInboxItems,
  getPendingInboxCount,
} from "@/server/queries/intercom-inbox";
import type { ActionResult, PaginationParams } from "@/types";
import type { IntercomInboxStatus } from "@/lib/constants/intercom";

export async function fetchIntercomInbox(
  params: PaginationParams & { status?: IntercomInboxStatus }
) {
  await getRequiredSession();
  return getIntercomInboxItems(params);
}

export async function fetchPendingIntercomCount(): Promise<number> {
  await getRequiredSession();
  return getPendingInboxCount();
}

export async function convertToIncident(
  input: unknown
): Promise<ActionResult<{ incidentId: string; incidentNumber: string }>> {
  const session = await getRequiredSession();

  const parsed = convertToIncidentSchema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    return { success: false, error: `Datos inválidos: ${fields}` };
  }

  const { inboxItemId, title, description, category, priority, ...rest } = parsed.data;

  try {
    // Fetch inbox item
    const [item] = await db
      .select()
      .from(intercomInbox)
      .where(eq(intercomInbox.id, inboxItemId))
      .limit(1);

    if (!item) {
      return { success: false, error: "Elemento no encontrado en la bandeja" };
    }

    if (item.status === "convertida") {
      return { success: false, error: "Este elemento ya fue convertido a incidencia" };
    }

    // Check for duplicate by intercom conversation ID
    const [existing] = await db
      .select({ id: incidents.id, incidentNumber: incidents.incidentNumber })
      .from(incidents)
      .where(eq(incidents.intercomEscalationId, item.intercomConversationId))
      .limit(1);

    if (existing) {
      return {
        success: false,
        error: `Ya existe la incidencia ${existing.incidentNumber} para esta conversación`,
      };
    }

    // Create incident + update inbox in transaction
    const result = await db.transaction(async (tx) => {
      const incidentNumber = await generateSequentialId("INC");

      const [newIncident] = await tx
        .insert(incidents)
        .values({
          incidentNumber,
          title,
          description: description || null,
          category,
          priority,
          status: "nuevo",
          clientName: rest.clientName || item.contactName || null,
          deviceType: rest.deviceType || null,
          deviceBrand: rest.deviceBrand || null,
          deviceModel: rest.deviceModel || null,
          contactName: rest.contactName || item.contactName || null,
          contactPhone: rest.contactPhone || null,
          intercomUrl: `https://app.intercom.com/a/inbox/conversation/${item.intercomConversationId}`,
          intercomEscalationId: item.intercomConversationId,
        })
        .returning({ id: incidents.id, incidentNumber: incidents.incidentNumber });

      // Update inbox item
      await tx
        .update(intercomInbox)
        .set({
          status: "convertida",
          convertedIncidentId: newIncident.id,
          convertedByUserId: session.user.id,
          convertedAt: new Date(),
        })
        .where(eq(intercomInbox.id, inboxItemId));

      // Event log
      await tx.insert(eventLogs).values({
        entityType: "incident",
        entityId: newIncident.id,
        action: "created",
        toState: "nuevo",
        userId: session.user.id,
        details: { source: "intercom_inbox", intercomConversationId: item.intercomConversationId },
      });

      return newIncident;
    });

    revalidatePath("/intercom");
    revalidatePath("/incidents");
    return {
      success: true,
      data: { incidentId: result.id, incidentNumber: result.incidentNumber },
    };
  } catch (err) {
    console.error("Error converting to incident:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al crear incidencia: ${message}` };
  }
}

export async function dismissInboxItem(
  input: unknown
): Promise<ActionResult<void>> {
  const session = await getRequiredSession();

  const parsed = dismissInboxItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  try {
    await db
      .update(intercomInbox)
      .set({
        status: "descartada",
        dismissedByUserId: session.user.id,
        dismissedAt: new Date(),
      })
      .where(eq(intercomInbox.id, parsed.data.inboxItemId));

    revalidatePath("/intercom");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al descartar elemento" };
  }
}

export async function restoreInboxItem(
  inboxItemId: string
): Promise<ActionResult<void>> {
  await getRequiredSession();

  try {
    await db
      .update(intercomInbox)
      .set({
        status: "pendiente",
        dismissedByUserId: null,
        dismissedAt: null,
      })
      .where(eq(intercomInbox.id, inboxItemId));

    revalidatePath("/intercom");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al restaurar elemento" };
  }
}
