/**
 * Intercom sync utilities.
 * Handles HSM → Intercom communication (internal notes on state changes).
 * All calls are fire-and-forget to not block HSM operations.
 *
 * IMPORTANT: requires `INTERCOM_ADMIN_ID` env var to be set to a valid
 * admin ID (see .env.example for instructions). Without it, Intercom
 * rejects the note creation requests silently.
 */

import { addNote } from "./client";
import { INCIDENT_STATUS_LABELS } from "@/lib/constants/incidents";
import { RMA_STATUS_LABELS } from "@/lib/constants/rmas";

function getAdminId(): string | null {
  const id = process.env.INTERCOM_ADMIN_ID;
  if (!id || id === "0" || id.trim() === "") {
    console.warn(
      "[Intercom sync] INTERCOM_ADMIN_ID not configured — notes won't be posted. " +
      "Set it in Vercel env vars. See .env.example for instructions."
    );
    return null;
  }
  return id;
}

/**
 * Extract conversation ID from Intercom URL or raw ID string.
 * Handles formats:
 * - Raw conversation ID (digits only): "123456"
 * - Modern URL: https://app.intercom.com/a/inbox/{workspace}/conversation/{id}
 * - Inbox view URL: https://app.intercom.com/a/inbox/{workspace}/inbox/view/{viewId}/conversation/{id}
 * - Legacy URL: https://app.intercom.com/a/apps/{workspace}/inbox/inbox/all/conversations/{id}
 */
export function extractConversationId(intercomUrl: string): string | null {
  if (!intercomUrl) return null;

  // Trim whitespace
  const trimmed = intercomUrl.trim();

  // Direct ID (just digits)
  if (/^\d+$/.test(trimmed)) return trimmed;

  // Try multiple URL patterns (last digit group after a known segment)
  // Capture id from "/conversation/123" or "/conversations/123"
  const patterns = [
    /\/conversation\/(\d+)(?:\/|$|\?|#)/,
    /\/conversations\/(\d+)(?:\/|$|\?|#)/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  console.warn(
    `[Intercom sync] Could not extract conversation ID from URL: ${trimmed.slice(0, 100)}`
  );
  return null;
}

function resolveConversationId(opts: {
  intercomUrl: string | null;
  intercomEscalationId: string | null;
}): string | null {
  // Prefer escalationId (already a raw ID) over URL parsing
  if (opts.intercomEscalationId && opts.intercomEscalationId.trim() !== "") {
    return opts.intercomEscalationId.trim();
  }
  return extractConversationId(opts.intercomUrl ?? "");
}

/**
 * Post a note to Intercom when an incident state changes.
 * Fire-and-forget: logs errors but never throws.
 *
 * When the incident reaches a terminal state (resuelto/cerrado), the note
 * explicitly asks the CX team to close the linked Intercom ticket. We do
 * NOT attempt to close the ticket programmatically — see B2 note below.
 */
export async function syncIncidentTransition(opts: {
  intercomUrl: string | null;
  intercomEscalationId: string | null;
  incidentNumber: string;
  fromStatus: string;
  toStatus: string;
  comment?: string;
}): Promise<void> {
  const conversationId = resolveConversationId(opts);
  if (!conversationId) {
    console.info(
      `[Intercom sync] Skipped — no Intercom reference for incident ${opts.incidentNumber}`
    );
    return;
  }

  const adminId = getAdminId();
  if (!adminId) return;

  const fromLabel = INCIDENT_STATUS_LABELS[opts.fromStatus as keyof typeof INCIDENT_STATUS_LABELS] ?? opts.fromStatus;
  const toLabel = INCIDENT_STATUS_LABELS[opts.toStatus as keyof typeof INCIDENT_STATUS_LABELS] ?? opts.toStatus;

  const lines = [
    `📋 [HSM] Incidencia ${opts.incidentNumber} actualizada`,
    `Estado: ${fromLabel} → ${toLabel}`,
  ];
  if (opts.comment) lines.push(`Comentario: ${opts.comment}`);

  // Terminal states: ask CX to close the linked Intercom ticket manually.
  // TODO: implement automated ticket closure. Requires fetching the
  //       conversation's linked ticket(s) and PUT /tickets/{id} with the
  //       workspace's "resolved" state. See B2 audit notes.
  if (opts.toStatus === "resuelto" || opts.toStatus === "cerrado") {
    lines.push("");
    lines.push("✅ La incidencia está resuelta en HSM — este folio puede cerrarse.");
  }

  try {
    await addNote(conversationId, lines.join("\n"), adminId);
  } catch (err) {
    console.error(
      `[Intercom sync] Error posting note to conversation ${conversationId}:`,
      err
    );
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
  const conversationId = resolveConversationId(opts);
  if (!conversationId) {
    console.info(
      `[Intercom sync] Skipped manual note — no Intercom reference for ${opts.entityType} ${opts.entityNumber}`
    );
    return;
  }

  const adminId = getAdminId();
  if (!adminId) return;

  const entityLabel = opts.entityType === "incident" ? "Incidencia" : "RMA";
  const header = `📝 [HSM] Nota de ${opts.authorName} en ${entityLabel} ${opts.entityNumber}`;
  const messageBody = `${header}\n\n${opts.body}`;

  try {
    await addNote(conversationId, messageBody, adminId);
  } catch (err) {
    console.error(
      `[Intercom sync] Error posting manual note to conversation ${conversationId}:`,
      err
    );
  }
}

/**
 * Post a note to Intercom when an RMA state changes.
 * Fire-and-forget: logs errors but never throws.
 *
 * RMAs don't have intercomUrl/escalationId directly — the caller must fetch
 * the linked incident's Intercom fields and pass them here.
 */
export async function syncRmaTransition(opts: {
  intercomUrl: string | null;
  intercomEscalationId: string | null;
  rmaNumber: string;
  fromStatus: string;
  toStatus: string;
  comment?: string;
}): Promise<void> {
  const conversationId = resolveConversationId(opts);
  if (!conversationId) {
    console.info(
      `[Intercom sync] Skipped — no Intercom reference for ${opts.rmaNumber}`
    );
    return;
  }

  const adminId = getAdminId();
  if (!adminId) return;

  const fromLabel = RMA_STATUS_LABELS[opts.fromStatus as keyof typeof RMA_STATUS_LABELS] ?? opts.fromStatus;
  const toLabel = RMA_STATUS_LABELS[opts.toStatus as keyof typeof RMA_STATUS_LABELS] ?? opts.toStatus;

  const lines = [
    `📦 [HSM] ${opts.rmaNumber} actualizado`,
    `Estado: ${fromLabel} → ${toLabel}`,
  ];
  if (opts.comment) lines.push(`Comentario: ${opts.comment}`);

  try {
    await addNote(conversationId, lines.join("\n"), adminId);
  } catch (err) {
    console.error(
      `[Intercom sync] Error posting RMA note to conversation ${conversationId}:`,
      err
    );
  }
}
