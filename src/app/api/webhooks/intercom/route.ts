import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { intercomInbox } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getConversation, getContact } from "@/lib/intercom/client";
import { buildAttrsMap, getAttr } from "@/lib/intercom/ticket-attrs";
import { getIntercomCaptureRules } from "@/server/queries/settings";
import { DEFAULT_INTERCOM_CAPTURE_RULES } from "@/lib/constants/intercom-capture";

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

  // Build subject: prefer conversation custom_attributes, then ticket_attributes, then fallbacks.
  // Uses normalized lookups (BOM-tolerant, case-insensitive, colon-agnostic) so subtle
  // variations in the key name don't silently break the extraction.
  const ticketAttrs = buildAttrsMap(item.ticket_attributes);
  const convAttrs = buildAttrsMap(item.custom_attributes);
  const problemSummary = getAttr(
    ticketAttrs,
    "Resumen del problema del cliente",
    "Resumen del problema",
    "Problema del cliente",
  );
  const incidentSummary = getAttr(convAttrs, "Resumen de la incidencia", "Resumen incidencia");
  const ticketTypeName = item.ticket_type?.name ?? null;
  const subject = incidentSummary
    ?? (problemSummary ? `${ticketTypeName ?? "Ticket"}: ${problemSummary}` : null)
    ?? item.source?.subject ?? item.title ?? ticketTypeName ?? null;

  // Assignee: find the admin who created the ticket (not bot)
  const adminPart = item.ticket_parts?.ticket_parts?.find?.(
    (p: any) => p.author?.type === "admin"
  );
  const assigneeName = adminPart?.author?.name ?? null;

  return { conversationId, contactName, contactEmail, subject, assigneeName };
}

function flattenAttributes(attrs: unknown): string {
  // Convierte un objeto de custom_attributes/ticket_attributes a un único string
  // para que la búsqueda de keywords incluya también esos campos.
  if (!attrs || typeof attrs !== "object") return "";
  try {
    const parts: string[] = [];
    for (const value of Object.values(attrs as Record<string, unknown>)) {
      if (value == null) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        parts.push(String(value));
      } else if (typeof value === "object") {
        // Algunas attrs vienen como { value: "..." }
        const inner = (value as { value?: unknown }).value;
        if (inner != null) parts.push(String(inner));
      }
    }
    return parts.join(" ");
  } catch {
    return "";
  }
}

async function isRelevantEscalation(payload: any): Promise<boolean> {
  const item = payload?.data?.item;
  if (!item) return false;

  // Reglas configurables (Ajustes). Fallback seguro a las de por defecto si la
  // lectura falla — el webhook NUNCA debe romperse por esto.
  let rules = DEFAULT_INTERCOM_CAPTURE_RULES;
  try {
    rules = await getIntercomCaptureRules();
  } catch (err) {
    console.error("[Intercom Webhook] no se pudieron leer reglas de captura, uso defaults:", err);
  }

  const fieldsToCheck = [
    item.ticket_type?.name,
    item.ticket_type?.description,
    item.source?.subject,
    item.title,
    item.source?.body?.substring?.(0, 500),
    ...(item.tags?.tags?.map?.((t: any) => t.name) ?? []),
    // G2: ampliar match a custom_attributes y ticket_attributes — antes se perdían
    // conversaciones donde CX marca el caso en un custom field sin ponerlo en subject/body.
    flattenAttributes(item.custom_attributes),
    flattenAttributes(item.ticket_attributes),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // 1) keyword en texto/atributos
  const keywords = (rules.keywords ?? []).map((s) => s.toLowerCase()).filter(Boolean);
  if (keywords.some((kw) => fieldsToCheck.includes(kw))) return true;

  // 2) ticket type concreto (p.ej. "Folio de atención backoffice escalado a hardware")
  const ttName = String(item.ticket_type?.name ?? "").toLowerCase();
  if (ttName && (rules.ticketTypes ?? []).some((t) => t && ttName.includes(t.toLowerCase()))) return true;

  // 3) tag concreto
  const tagNames: string[] = (item.tags?.tags?.map?.((t: any) => String(t.name ?? "").toLowerCase()) ?? []);
  if ((rules.tags ?? []).some((t) => t && tagNames.includes(t.toLowerCase()))) return true;

  return false;
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
  const relevant = await isRelevantEscalation(payload);

  console.log(
    `[Intercom Webhook] Topic: ${topic} | ID: ${conversationId} | Contact: ${contactName ?? "null"} | Subject: ${subject ?? "null"} | Relevant: ${relevant}`
  );

  // G1: en lugar de descartar silenciosamente, guardar en la bandeja con status="descartada"
  // y un motivo. Así la pestaña "Descartadas" se vuelve útil para auditar el filtro.
  if (!conversationId) {
    console.log(`[Intercom Webhook] Skipped — no conversation ID extractable`);
    return NextResponse.json({ ok: true, skipped: "no-conversation-id" });
  }

  if (!relevant) {
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
          status: "descartada",
          discardReason: "webhook_no_keyword_match",
        })
        .onConflictDoNothing({ target: intercomInbox.intercomConversationId });
      console.log(`[Intercom Webhook] Descartada (sin keywords) ${conversationId}`);
    } catch (err) {
      console.error("[Intercom Webhook] DB error guardando descartada:", err);
    }
    return NextResponse.json({ ok: true, skipped: "no-keyword-match" });
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

  // Enrich: fetch full contact data from Intercom API + extract company/custom_attributes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemData = (payload as any)?.data?.item;

  // Extract company and custom_attributes directly from the payload (always available)
  const companyData = itemData?.company ?? null;
  const convCustomAttrs = itemData?.custom_attributes ?? {};
  const enrichedCompany = {
    companyId: companyData?.company_id ?? null,
    restaurantName: companyData?.custom_attributes?.restaurant_name ?? null,
    serialNumber: companyData?.custom_attributes?.serial_number ?? null,
    accountManager: companyData?.custom_attributes?.account_manager ?? null,
    companyIntercomName: companyData?.name ?? null,
  };
  const extractedAttributes = {
    categoria: convCustomAttrs["Categoría"] ?? null,
    categoria2: convCustomAttrs["Categoría - 2"] ?? null,
    categoria3: convCustomAttrs["Categoría - 3"] ?? null,
    tipo: convCustomAttrs["Tipo"] ?? null,
    urgencia: convCustomAttrs["Urgencia"] ?? null,
    resumenIncidencia: convCustomAttrs["Resumen de la incidencia"] ?? null,
    atendidoEnLlamada: convCustomAttrs["Atendido en llamada"] ?? null,
    aiIssueSummary: convCustomAttrs["AI Issue summary"] ?? null,
  };

  if (process.env.INTERCOM_ACCESS_TOKEN) {
    try {
      // Find the contact reference in the ticket payload
      const contactRef =
        (itemData?.contacts?.type === "contact" ? itemData.contacts : null) ??
        itemData?.contacts?.contacts?.[0] ??
        itemData?.contacts?.[0];

      let enrichedContact: { name: string | null; email: string | null; phone: string | null; companyName: string | null } = {
        name: contactName, email: contactEmail, phone: null, companyName: enrichedCompany.companyIntercomName,
      };

      if (contactRef?.id && contactRef?.type === "contact") {
        console.log(`[Intercom Webhook] Fetching contact: ${contactRef.id}`);
        const contact = await getContact(contactRef.id);
        enrichedContact = {
          name: contact.name ?? enrichedContact.name,
          email: contact.email ?? enrichedContact.email,
          phone: contact.phone ?? null,
          companyName: contact.company?.name ?? enrichedContact.companyName,
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

      // Update DB with enriched data + store enrichedContact + enrichedCompany + extractedAttributes in rawPayload
      const enrichedPayload = { ...(payload as Record<string, unknown>), enrichedContact, enrichedCompany, extractedAttributes };
      await db
        .update(intercomInbox)
        .set({
          contactName: enrichedContact.name,
          contactEmail: enrichedContact.email,
          rawPayload: enrichedPayload,
          updatedAt: new Date(),
        })
        .where(eq(intercomInbox.intercomConversationId, conversationId));

      console.log(`[Intercom Webhook] Enriched ${conversationId}: ${enrichedContact.name} <${enrichedContact.email}> phone:${enrichedContact.phone} company:${enrichedCompany.restaurantName ?? enrichedContact.companyName} restaurantId:${enrichedCompany.companyId}`);
    } catch (err) {
      console.log(`[Intercom Webhook] Enrichment failed: ${err}`);
    }
  } else {
    // Even without API token, save company/attribute data from the payload
    try {
      const enrichedPayload = { ...(payload as Record<string, unknown>), enrichedCompany, extractedAttributes };
      await db
        .update(intercomInbox)
        .set({
          rawPayload: enrichedPayload,
          updatedAt: new Date(),
        })
        .where(eq(intercomInbox.intercomConversationId, conversationId));
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true });
}
