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

  // Conversation ID: could be item.id directly, or nested in ticket
  const conversationId = String(
    item.conversation_id ?? item.id ?? ""
  );

  // Contact: conversations have contacts.contacts[], tickets have contacts[] or user
  const contact =
    item.contacts?.contacts?.[0] ??
    item.contacts?.[0] ??
    item.user ??
    null;
  const contactName = contact?.name ?? null;
  const contactEmail = contact?.email ?? null;

  // Subject: multiple possible locations
  const subject =
    item.source?.subject ??
    item.title ??
    item.ticket_type?.name ??
    item.source?.body?.substring?.(0, 200) ??
    null;

  // Assignee: conversations have teammates.admins[], tickets have admin_assignee
  const assignee =
    item.teammates?.admins?.[0] ??
    item.admin_assignee ??
    null;
  const assigneeName = assignee?.name ?? null;

  return { conversationId, contactName, contactEmail, subject, assigneeName };
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

  if (!verifySignature(body, signature, secret)) {
    console.error("Webhook firma inválida");
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const topic = (payload.topic as string) ?? "";
  console.log(`[Intercom Webhook] Topic: ${topic}`);

  // Extract data from any topic structure
  const { conversationId, contactName, contactEmail, subject, assigneeName } = extractData(payload);

  // Only accept escalations relevant to our department (Hardware / RMA)
  const RELEVANT_KEYWORDS = ["hardware", "rma", "escalado a hardware", "escalado para la gestión de un rma"];
  const payloadText = JSON.stringify(payload).toLowerCase();
  const isRelevant = RELEVANT_KEYWORDS.some((kw) => payloadText.includes(kw));

  if (!isRelevant) {
    console.log(`[Intercom Webhook] Not relevant to Hardware/RMA, skipping`);
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!conversationId) {
    console.log("[Intercom Webhook] No conversation ID found, skipping");
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
    return NextResponse.json({ ok: true }); // 200 to prevent retries
  }
}
