/**
 * Intercom sync utilities.
 * Handles HSM → Intercom communication (notes, ticket closure).
 * All calls are fire-and-forget to not block HSM operations.
 */

import { addNote, closeTicket } from "./client";
import { INCIDENT_STATUS_LABELS } from "@/lib/constants/incidents";
import { RMA_STATUS_LABELS } from "@/lib/constants/rmas";

const INTERCOM_ADMIN_ID = process.env.INTERCOM_ADMIN_ID || "0";

/**
 * Extract conversation ID from Intercom URL.
 * Handles formats like:
 * - https://app.intercom.com/a/inbox/.../conversation/123456
 * - https://app.intercom.com/a/inbox/.../inbox/view/123456/conversation/789
 * - Raw conversation ID
 */
export function extractConversationId(intercomUrl: string): string | null {
  if (!intercomUrl) return null;
  // Direct conversation ID (just digits)
  if (/^\d+$/.test(intercomUrl)) return intercomUrl;
  // URL pattern
  const match = intercomUrl.match(/conversation\/(\d+)/);
  return match?.[1] ?? null;
}

/**
 * Post a note to Intercom when an incident state changes.
 * Fire-and-forget: logs errors but never throws.
 */
export async function syncIncidentTransition(opts: {
  intercomUrl: string | null;
  intercomEscalationId: string | null;
  incidentNumber: string;
  fromStatus: string;
  toStatus: string;
  comment?: string;
}): Promise<void> {
  const conversationId = opts.intercomEscalationId
    ?? extractConversationId(opts.intercomUrl ?? "");
  if (!conversationId) return;

  const fromLabel = INCIDENT_STATUS_LABELS[opts.fromStatus as keyof typeof INCIDENT_STATUS_LABELS] ?? opts.fromStatus;
  const toLabel = INCIDENT_STATUS_LABELS[opts.toStatus as keyof typeof INCIDENT_STATUS_LABELS] ?? opts.toStatus;

  const lines = [
    `📋 [HSM] Incidencia ${opts.incidentNumber} actualizada`,
    `Estado: ${fromLabel} → ${toLabel}`,
  ];
  if (opts.comment) lines.push(`Comentario: ${opts.comment}`);

  try {
    await addNote(conversationId, lines.join("\n"), INTERCOM_ADMIN_ID);

    // Close ticket when incident is resolved or closed
    if (opts.toStatus === "resuelto" || opts.toStatus === "cerrado") {
      try {
        await closeTicket(conversationId);
      } catch (ticketErr) {
        // Ticket close may fail if it's a conversation, not a ticket — that's OK
        console.warn("[Intercom sync] Could not close ticket (may be a conversation):", ticketErr);
      }
    }
  } catch (err) {
    console.error("[Intercom sync] Error posting note:", err);
  }
}

/**
 * Post a manual note from a technician to Intercom.
 * Fire-and-forget: logs errors but never throws.
 *
 * Plantilla con el nombre del técnico humano porque la API postea siempre con
 * el mismo admin_id genérico — el prefijo es la única forma de identificar al
 * autor real desde Intercom.
 */
export async function syncManualNote(opts: {
  intercomUrl: string | null;
  intercomEscalationId: string | null;
  entityType: "incident" | "rma";
  entityNumber: string;
  authorName: string;
  body: string;
}): Promise<void> {
  const conversationId = opts.intercomEscalationId
    ?? extractConversationId(opts.intercomUrl ?? "");
  if (!conversationId) return;

  const entityLabel = opts.entityType === "incident" ? "Incidencia" : "RMA";
  const header = `📝 [HSM] Nota de ${opts.authorName} en ${entityLabel} ${opts.entityNumber}`;
  const messageBody = `${header}\n\n${opts.body}`;

  try {
    await addNote(conversationId, messageBody, INTERCOM_ADMIN_ID);
  } catch (err) {
    console.error("[Intercom sync] Error posting manual note:", err);
  }
}

/**
 * Post a note to Intercom when an RMA state changes.
 * Fire-and-forget: logs errors but never throws.
 */
export async function syncRmaTransition(opts: {
  intercomUrl: string | null;
  intercomEscalationId: string | null;
  rmaNumber: string;
  fromStatus: string;
  toStatus: string;
  comment?: string;
}): Promise<void> {
  const conversationId = opts.intercomEscalationId
    ?? extractConversationId(opts.intercomUrl ?? "");
  if (!conversationId) return;

  const fromLabel = RMA_STATUS_LABELS[opts.fromStatus as keyof typeof RMA_STATUS_LABELS] ?? opts.fromStatus;
  const toLabel = RMA_STATUS_LABELS[opts.toStatus as keyof typeof RMA_STATUS_LABELS] ?? opts.toStatus;

  const lines = [
    `📦 [HSM] RMA ${opts.rmaNumber} actualizado`,
    `Estado: ${fromLabel} → ${toLabel}`,
  ];
  if (opts.comment) lines.push(`Comentario: ${opts.comment}`);

  try {
    await addNote(conversationId, lines.join("\n"), INTERCOM_ADMIN_ID);
  } catch (err) {
    console.error("[Intercom sync] Error posting RMA note:", err);
  }
}
