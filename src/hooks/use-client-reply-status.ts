"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchIntercomConversation } from "@/server/actions/intercom-inbox";

/**
 * Señal ORIENTATIVA (hint) de la conversación de Intercom para el seguimiento
 * diario: ¿cuándo escribió el cliente por última vez y cuándo lo hicimos
 * nosotros? Lee vía `fetchIntercomConversation` (no toca `src/lib/intercom/*`).
 *
 * OJO: NO es autoritativo. Que el último mensaje público sea nuestro puede ser
 * soporte diciendo "mañana lo revisa Hardware" mientras el cliente sí ha
 * preguntado algo pendiente. Por eso devolvemos AMBOS últimos mensajes (cliente
 * y nuestro) para que el operador juzgue; la verdad la fija la marca manual
 * "Contacté". `createdAt` de Intercom es epoch en SEGUNDOS.
 */
export interface ClientReplyStatus {
  lastClient: { at: number; snippet: string } | null;
  lastOurs: { at: number; snippet: string } | null;
  /** Quién habló último en público — solo orientativo. */
  lastPublicAuthor: "client" | "us" | null;
}

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Notas que HSM publica en Intercom (sync). Son partType "note" (ya se filtran),
// pero por si acaso también descartamos por prefijo.
const HSM_NOTE_PREFIXES = ["📝 [HSM]", "📋 [HSM]"];

export function useClientReplyStatus(
  conversationId: string | null | undefined,
  enabled = true,
) {
  const id = conversationId?.toString().trim() || null;
  return useQuery({
    queryKey: ["client-reply", id],
    enabled: !!id && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ClientReplyStatus> => {
      const res = await fetchIntercomConversation(id!);
      if (!res.success) return { lastClient: null, lastOurs: null, lastPublicAuthor: null };
      const msgs = res.data.messages
        .filter((m) => m.partType !== "note")
        .filter((m) => { const t = strip(m.body); return !HSM_NOTE_PREFIXES.some((p) => t.startsWith(p)); })
        .sort((a, b) => a.createdAt - b.createdAt);

      let lastClient: ClientReplyStatus["lastClient"] = null;
      let lastOurs: ClientReplyStatus["lastOurs"] = null;
      for (const m of msgs) {
        const snippet = strip(m.body).slice(0, 140);
        if (m.authorType === "user" || m.authorType === "lead") lastClient = { at: m.createdAt, snippet };
        else if (m.authorType === "admin") lastOurs = { at: m.createdAt, snippet };
      }
      const last = msgs[msgs.length - 1];
      const lastPublicAuthor = !last ? null : last.authorType === "admin" ? "us" : "client";
      return { lastClient, lastOurs, lastPublicAuthor };
    },
  });
}
