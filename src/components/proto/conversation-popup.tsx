"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, Shield, User, StickyNote, MessageSquare, ExternalLink } from "lucide-react";
import { fetchIntercomConversation, type ConversationMessage } from "@/server/actions/intercom-inbox";

interface Props {
  conversationId: string | null;
  title?: string;
  subtitle?: string;
  intercomUrl?: string | null;
  onClose: () => void;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Popup ligero para echar un vistazo rápido a la conversación de Intercom
 * (lo último que ha escrito el cliente). Reutiliza la misma server action y
 * queryKey que el hilo de la ficha — sin tocar la integración de Intercom.
 */
export function ConversationPopup({ conversationId, title, subtitle, intercomUrl, onClose }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // Portal a document.body para escapar del contexto de apilamiento del drawer
  // (si no, el popup saldría DETRÁS de la ficha lateral). Se monta solo en cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["intercom-conversation", conversationId],
    queryFn: () => fetchIntercomConversation(conversationId!),
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });

  const messages: ConversationMessage[] = data?.success ? data.data.messages : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-scroll al último mensaje (lo más reciente) cuando cargan los datos.
  useEffect(() => {
    if (messages.length && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages.length]);

  if (!conversationId || !mounted) return null;

  return createPortal(
    <>
      <div className="drawer-overlay" style={{ zIndex: 120 }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed", zIndex: 121, top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(560px, 94vw)", maxHeight: "82vh", display: "flex", flexDirection: "column",
          background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-l)",
          boxShadow: "var(--shadow-elev)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
              <MessageSquare size={16} style={{ color: "var(--primary)" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title ?? "Conversación Intercom"}</span>
            </div>
            {subtitle && <div className="muted text-xs" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {isLoading && (
            <div className="flex items-center justify-center muted" style={{ padding: 24, gap: 8 }}>
              <Loader2 size={16} className="animate-spin" /> Cargando conversación…
            </div>
          )}
          {error && <div className="text-sm" style={{ color: "var(--danger)", textAlign: "center", padding: 16 }}>Error al cargar la conversación</div>}
          {!isLoading && !error && messages.length === 0 && (
            <div className="muted text-sm" style={{ textAlign: "center", padding: 16 }}>No se encontraron mensajes</div>
          )}
          {messages.map((m) => <Bubble key={m.id} msg={m} />)}
        </div>

        {/* Footer */}
        {intercomUrl && (
          <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <a href={intercomUrl} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">
              <ExternalLink size={14} /> Abrir en Intercom
            </a>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

function Bubble({ msg }: { msg: ConversationMessage }) {
  const isAdmin = msg.authorType === "admin";
  const isNote = msg.partType === "note";
  const text = stripHtml(msg.body);
  const icon = isNote ? <StickyNote size={13} /> : isAdmin ? <Shield size={13} /> : <User size={13} />;

  return (
    <div style={{ display: "flex", gap: 10, flexDirection: isAdmin ? "row-reverse" : "row" }}>
      <div
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: isNote ? "var(--amber-50)" : isAdmin ? "var(--orange-50)" : "var(--gray-100)",
          color: isNote ? "var(--amber-900)" : isAdmin ? "var(--primary)" : "var(--fg-secondary)",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          flex: 1, minWidth: 0, borderRadius: 10, padding: "8px 12px", fontSize: 13,
          background: isNote ? "var(--amber-50)" : isAdmin ? "var(--orange-50)" : "var(--gray-50)",
          border: isNote ? "1px solid var(--amber-200, #ffe7b3)" : "1px solid var(--border-light, var(--border))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{msg.authorName}</span>
          {isNote && <span style={{ fontSize: 10, color: "var(--amber-900)", fontWeight: 600, textTransform: "uppercase" }}>Nota interna</span>}
          <span className="muted" style={{ fontSize: 10, marginLeft: "auto" }}>{formatTs(msg.createdAt)}</span>
        </div>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, margin: 0 }}>{text}</p>
      </div>
    </div>
  );
}
