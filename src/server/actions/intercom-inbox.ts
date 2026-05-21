"use server";

import { db } from "@/lib/db";
import { intercomInbox, incidents, eventLogs, clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import { getConversation, getContact } from "@/lib/intercom/client";
import { extractConversationId } from "@/lib/intercom/sync";
import type { IntercomConversationPart } from "@/lib/intercom/types";
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

/**
 * G3 — Importación bajo demanda de una conversación de Intercom a la bandeja.
 *
 * Acepta una URL de Intercom o un ID raw. Útil para el caso "no llegó por webhook"
 * (filtros silenciaron la conversación, fue creada antes del webhook, etc.).
 * Salta el filtro de keywords del webhook porque es importación explícita.
 */
export async function importIntercomConversation(
  urlOrId: string
): Promise<ActionResult<{ inboxItemId: string; alreadyExisted: boolean; intercomConversationId: string }>> {
  await getRequiredSession();

  const trimmed = (urlOrId ?? "").trim();
  if (!trimmed) {
    return { success: false, error: "Indica una URL de Intercom o un ID de conversación" };
  }

  const conversationId = extractConversationId(trimmed);
  if (!conversationId) {
    return { success: false, error: "No se pudo extraer el ID. Usa una URL de conversación de Intercom o el ID numérico." };
  }

  // Dedup: si ya está en la bandeja, devolverla con flag para que la UI navegue a ella.
  const [existing] = await db
    .select({ id: intercomInbox.id, status: intercomInbox.status })
    .from(intercomInbox)
    .where(eq(intercomInbox.intercomConversationId, conversationId))
    .limit(1);

  if (existing) {
    return {
      success: true,
      data: { inboxItemId: existing.id, alreadyExisted: true, intercomConversationId: conversationId },
    };
  }

  // Traer la conversación de Intercom.
  let conversation;
  try {
    conversation = await getConversation(conversationId);
  } catch (err) {
    console.error("[importIntercomConversation] Error fetching conversation:", err);
    const message = err instanceof Error ? err.message : "Error al consultar Intercom";
    return { success: false, error: `No se pudo obtener la conversación de Intercom: ${message}` };
  }

  // Extraer contacto principal.
  const primaryContact = conversation.contacts?.contacts?.[0] ?? null;
  let contactName: string | null = primaryContact?.name ?? null;
  let contactEmail: string | null = primaryContact?.email ?? null;
  let contactPhone: string | null = null;
  let companyName: string | null = null;

  // Enriquecer con getContact si tenemos token y un ID de contacto.
  if (primaryContact?.id && process.env.INTERCOM_ACCESS_TOKEN) {
    try {
      const fullContact = await getContact(primaryContact.id);
      contactName = fullContact.name ?? contactName;
      contactEmail = fullContact.email ?? contactEmail;
      contactPhone = fullContact.phone ?? null;
      companyName = fullContact.company?.name ?? null;
    } catch (err) {
      console.warn("[importIntercomConversation] Enrichment de contacto falló:", err);
    }
  }

  const subject =
    conversation.source?.subject ??
    conversation.title ??
    `Conversación Intercom ${conversationId}`;

  const enrichedPayload = {
    _importedAt: new Date().toISOString(),
    _importedFrom: trimmed,
    conversation,
    enrichedContact: { name: contactName, email: contactEmail, phone: contactPhone, companyName },
  };

  const [inserted] = await db
    .insert(intercomInbox)
    .values({
      intercomConversationId: conversationId,
      contactName,
      contactEmail,
      subject,
      assigneeName: null,
      rawPayload: enrichedPayload,
      status: "pendiente",
    })
    .returning({ id: intercomInbox.id });

  revalidatePath("/intercom");

  return {
    success: true,
    data: { inboxItemId: inserted.id, alreadyExisted: false, intercomConversationId: conversationId },
  };
}

/**
 * Recupera una conversación descartada a "pendiente" para procesarla.
 * Útil tras la pestaña "Descartadas" llena por filtros del webhook.
 */
export async function recoverDiscardedInboxItem(
  inboxItemId: string
): Promise<ActionResult<void>> {
  await getRequiredSession();

  try {
    await db
      .update(intercomInbox)
      .set({
        status: "pendiente",
        discardReason: null,
      })
      .where(eq(intercomInbox.id, inboxItemId));

    revalidatePath("/intercom");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al recuperar elemento descartado" };
  }
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

  const { inboxItemId, title, description, category, hardwareOrigin, priority, ...rest } = parsed.data;

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

    // Resolve clientId → clientName from DB if provided
    const resolvedClientId: string | null = rest.clientId || null;
    let resolvedClientName: string | null = rest.clientName || item.contactName || null;
    if (resolvedClientId) {
      const [client] = await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, resolvedClientId))
        .limit(1);
      if (client) resolvedClientName = client.name;
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
          hardwareOrigin,
          priority,
          status: "nuevo",
          // G5: auto-asignar al técnico que convierte. Resuelve un campo crítico que
          // siempre quedaba vacío al venir desde la bandeja. Reasignable después.
          assignedUserId: session.user.id,
          clientId: resolvedClientId,
          clientName: resolvedClientName,
          deviceType: rest.deviceType || null,
          deviceBrand: rest.deviceBrand || null,
          deviceModel: rest.deviceModel || null,
          deviceSerialNumber: rest.deviceSerialNumber || null,
          contactName: rest.contactName || item.contactName || null,
          contactPhone: rest.contactPhone || null,
          pickupAddress: rest.pickupAddress || null,
          pickupCity: rest.pickupCity || null,
          pickupPostalCode: rest.pickupPostalCode || null,
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

export interface ConversationMessage {
  id: string;
  partType: string;
  body: string;
  authorName: string;
  authorType: string;
  createdAt: number;
}

export async function fetchIntercomConversation(
  conversationId: string
): Promise<ActionResult<{ messages: ConversationMessage[] }>> {
  await getRequiredSession();

  try {
    const conversation = await getConversation(conversationId);

    const messages: ConversationMessage[] = [];

    // Add the initial message (source)
    if (conversation.source?.body) {
      messages.push({
        id: conversation.source.id,
        partType: "comment",
        body: conversation.source.body,
        authorName: conversation.source.author?.name ?? "Cliente",
        authorType: conversation.source.author?.type ?? "user",
        createdAt: conversation.created_at,
      });
    }

    // Add conversation parts (replies, notes)
    const parts = conversation.conversation_parts?.conversation_parts ?? [];
    for (const part of parts) {
      if (!part.body) continue;
      messages.push({
        id: part.id,
        partType: part.part_type,
        body: part.body,
        authorName: part.author?.name ?? "Desconocido",
        authorType: part.author?.type ?? "unknown",
        createdAt: part.created_at,
      });
    }

    return { success: true, data: { messages } };
  } catch (err) {
    console.error("Error fetching Intercom conversation:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al cargar conversación: ${message}` };
  }
}
