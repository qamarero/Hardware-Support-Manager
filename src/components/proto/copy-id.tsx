"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value: string;
  /** Texto a mostrar si difiere del valor copiado (por defecto = value). */
  label?: string;
}

/**
 * Muestra un identificador (nº incidencia/RMA/proveedor) con un botón para
 * copiarlo al portapapeles en un clic. stopPropagation para no disparar el
 * click de la fila.
 */
export function CopyId({ value, label }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`Copiado: ${value}`);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label ?? value}
      <button
        type="button"
        onClick={copy}
        title="Copiar"
        aria-label={`Copiar ${value}`}
        style={{ border: 0, background: "transparent", cursor: "pointer", color: copied ? "var(--green-500)" : "var(--fg-tertiary)", display: "inline-flex", padding: 2, lineHeight: 0 }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}
