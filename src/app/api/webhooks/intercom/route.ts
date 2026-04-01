import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { intercomInbox } from "@/lib/db/schema";

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

  // Conversation ID: try multiple paths
  const conversationId = String(item.conversation_id ?? item.id ?? "");

  // Contact: try every known Intercom structure
  const contact =
    item.contacts?.contacts?.[0] ??
    item.contacts?.[0] ??
    item.user ??
    item.source?.author ??
    item.submitted_by ??
    null;

  // Name: try multiple fields
  const contactName =
    contact?.name ??
    contact?.display_as ??
    (contact?.first_name && contact?.last_name
      ? `${contact.first_name} ${contact.last_name}`
      : contact?.first_name ?? null);

  // Email: try multiple fields
  const contactEmail =
    contact?.email ??
    contact?.email_address ??
    null;

  // Subject: try multiple locations
  const subject =
    item.source?.subject ??
    item.title ??
    item.ticket_type?.name ??
    item.source?.body?.substring?.(0, 200) ??
    null;

  // Assignee: conversations vs tickets
  const assignee =
    item.teammates?.admins?.[0] ??
    item.admin_assignee ??
    null;
  const assigneeName = assignee?.name ?? null;

  return { conversationId, contactName, contactEmail, subject, assigneeName };
}

function isRelevantEscalation(payload: any): boolean {
  const item = payload?.data?.item;
  if (!item) return false;

  // Check specific semantic fields, NOT the entire JSON
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
        console.error("Webhook payload no tiene estructura de Intercom");
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

  // Detailed logging for Vercel runtime
  console.log(
    `[Intercom Webhook] Topic: ${topic} | ID: ${conversationId} | Contact: ${contactName ?? "null"} | Email: ${contactEmail ?? "null"} | Subject: ${subject ?? "null"} | Relevant: ${relevant}`
  );

  if (!relevant) {
    console.log(`[Intercom Webhook] Skipped — not Hardware/RMA`);
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!conversationId) {
    console.log("[Intercom Webhook] Skipped — no conversation ID");
    return NextResponse.json({ ok: true, skipped: true });
  }

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

    console.log(`[Intercom Webhook] Saved conversation ${conversationId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Intercom Webhook] DB error:", err);
    return NextResponse.json({ ok: true });
  }
}
