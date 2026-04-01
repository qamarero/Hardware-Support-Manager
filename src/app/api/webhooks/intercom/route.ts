import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { intercomInbox } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getConversation, getContact } from "@/lib/intercom/client";

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractData(payload: any): {
  conversationId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  subject: string | null;
  assigneeName: string | null;
} {
  const item = payload?.data?.item;
  if (!item) return { conversationId: null, contactName: null, contactEmail: null, subject: null, assigneeName: null };

  // For tickets, use linked conversation ID if available; fallback to ticket ID
  const linkedConvId = item.linked_objects?.data?.[0]?.id;
  const conversationId = String(linkedConvId ?? item.conversation_id ?? item.id ?? "");

  const contact =
    (item.contacts?.type === "contact" ? item.contacts : null) ??
    item.contacts?.contacts?.[0] ??
    item.contacts?.[0] ??
    item.user ??
    item.source?.author ??
    item.submitted_by ??
    null;

  const contactName =
    contact?.name ??
    contact?.display_as ??
    (contact?.first_name && contact?.last_name
      ? `${contact.first_name} ${contact.last_name}`
      : contact?.first_name ?? null);

  const contactEmail =
    contact?.email ??
    contact?.email_address ??
    null;

  // Build subject: prefer ticket_type name, add problem summary if available
  const attrs = item.ticket_attributes ?? {};
  const problemSummary = attrs["﻿Resumen del problema del cliente:"] ?? attrs["Resumen del problema del cliente:"] ?? null;
  const ticketTypeName = item.ticket_type?.name ?? null;
  const subject = problemSummary
    ? `${ticketTypeName ?? "Ticket"}: ${problemSummary}`
    : item.source?.subject ?? item.title ?? ticketTypeName ?? null;

  // Assignee: find the admin who created the ticket (not bot)
  const adminPart = item.ticket_parts?.ticket_parts?.find?.(
    (p: any) => p.author?.type === "admin"
  );
  const assigneeName = adminPart?.author?.name ?? null;

  return { conversationId, contactName, contactEmail, subject, assigneeName };
}

function isRelevantEscalation(payload: any): boolean {
  const item = payload?.data?.item;
  if (!item) return false;

  const fieldsToCheck = [
    item.ticket_type?.name,
    item.ticket_type?.description,
    item.source?.subject,
    item.title,
    item.source?.body?.substring?.(0, 500),
    ...(item.tags?.tags?.map?.((t: any) => t.name) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const RELEVANT_KEYWORDS = ["hardware", "rma"];
  return RELEVANT_KEYWORDS.some((kw) => fieldsToCheck.includes(kw));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(request: NextRequest) {
  const secret = process.env.INTERCOM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("INTERCOM_WEBHOOK_SECRET no configurado");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (signature) {
    if (!verifySignature(body, signature, secret)) {
      console.error("Webhook firma HMAC inválida");
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  } else {
    try {
      const parsed = JSON.parse(body);
      if (parsed.type !== "notification_event" || !parsed.data?.item) {
        return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const topic = (payload.topic as string) ?? "";
  const { conversationId, contactName, contactEmail, subject, assigneeName } = extractData(payload);
  const relevant = isRelevantEscalation(payload);

  console.log(
    `[Intercom Webhook] Topic: ${topic} | ID: ${conversationId} | Contact: ${contactName ?? "null"} | Subject: ${subject ?? "null"} | Relevant: ${relevant}`
  );

  if (!relevant) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!conversationId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Save immediately with whatever data we have
  try {
    await db
      .insert(intercomInbox)
      .values({
        intercomConversationId: conversationId,
        contactName,
        contactEmail,
        subject: subject ?? `Webhook: ${topic}`,
        assigneeName,
        rawPayload: payload,
      })
      .onConflictDoUpdate({
        target: intercomInbox.intercomConversationId,
        set: {
          contactName,
          contactEmail,
          subject: subject ?? `Webhook: ${topic}`,
          assigneeName,
          rawPayload: payload,
          updatedAt: new Date(),
        },
      });

    console.log(`[Intercom Webhook] Saved ${conversationId}`);
  } catch (err) {
    console.error("[Intercom Webhook] DB error:", err);
    return NextResponse.json({ ok: true });
  }

  // Enrich: fetch full contact data from Intercom API (name, email, phone, company)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemData = (payload as any)?.data?.item;
  if (process.env.INTERCOM_ACCESS_TOKEN) {
    try {
      // Find the contact reference in the ticket payload
      const contactRef =
        (itemData?.contacts?.type === "contact" ? itemData.contacts : null) ??
        itemData?.contacts?.contacts?.[0] ??
        itemData?.contacts?.[0];

      let enrichedContact: { name: string | null; email: string | null; phone: string | null; companyName: string | null } = {
        name: contactName, email: contactEmail, phone: null, companyName: null,
      };

      if (contactRef?.id && contactRef?.type === "contact") {
        console.log(`[Intercom Webhook] Fetching contact: ${contactRef.id}`);
        const contact = await getContact(contactRef.id);
        enrichedContact = {
          name: contact.name ?? enrichedContact.name,
          email: contact.email ?? enrichedContact.email,
          phone: contact.phone ?? null,
          companyName: contact.company?.name ?? null,
        };
      }

      // Fallback: try conversation if no contact ref
      if (!enrichedContact.name && !enrichedContact.email) {
        try {
          const conv = await getConversation(conversationId);
          const convContact = conv.contacts?.contacts?.[0];
          if (convContact) {
            enrichedContact.name = convContact.name ?? null;
            enrichedContact.email = convContact.email ?? null;
          }
        } catch { /* conversation fetch is best-effort */ }
      }

      // Update DB with enriched data + store enrichedContact in rawPayload
      const enrichedPayload = { ...(payload as Record<string, unknown>), enrichedContact };
      await db
        .update(intercomInbox)
        .set({
          contactName: enrichedContact.name,
          contactEmail: enrichedContact.email,
          rawPayload: enrichedPayload,
          updatedAt: new Date(),
        })
        .where(eq(intercomInbox.intercomConversationId, conversationId));

      console.log(`[Intercom Webhook] Enriched ${conversationId}: ${enrichedContact.name} <${enrichedContact.email}> phone:${enrichedContact.phone} company:${enrichedContact.companyName}`);
    } catch (err) {
      console.log(`[Intercom Webhook] Enrichment failed: ${err}`);
    }
    } catch (err) {
      console.log(`[Intercom Webhook] Enrichment failed: ${err}`);
    }
  }

  return NextResponse.json({ ok: true });
}
