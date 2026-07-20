"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Check, X, Plus } from "lucide-react";

export interface ComboOption {
  id: string;
  name: string;
  /** Texto secundario (p.ej. ID del cliente). Se muestra y es buscable. */
  hint?: string | null;
}

/** Acorta un identificador largo (UUID) para mostrarlo sin ocupar toda la fila. */
function shortHint(hint: string): string {
  return hint.length > 12 ? `${hint.slice(0, 8)}…` : hint;
}

interface ComboboxProps {
  options: ComboOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  /** Permite usar texto libre cuando no hay coincidencia (p.ej. cliente sin registrar). */
  allowFreeText?: boolean;
  /** Texto libre actual (cuando no hay id seleccionado). */
  freeText?: string;
  /** Callback al elegir un texto libre. */
  onFreeText?: (text: string) => void;
}

/**
 * Combobox con búsqueda de texto (estilo prototipo). Filtra en cliente —
 * adecuado para listas grandes (p.ej. ~3700 clientes) cargadas como id+name.
 * Con `allowFreeText`, si lo escrito no coincide con ninguna opción se puede
 * usar como texto libre (`onFreeText`) en vez de obligar a elegir de la lista.
 */
export function Combobox({ options, value, onChange, placeholder = "Buscar…", emptyLabel = "Sin resultados", allowFreeText = false, freeText = "", onFreeText }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const displayName = selected ? selected.name : (freeText || "");
  const hasValue = !!selected || !!freeText;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            (o.hint ?? "").toLowerCase().includes(q)
        )
      : options;
    return list.slice(0, 50); // limitar render
  }, [options, query]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {open ? (
        <div className="search" style={{ width: "100%" }}>
          <Search size={14} />
          <input
            autoFocus
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : (
        <button
          type="button"
          className="select"
          style={{ textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          onClick={() => setOpen(true)}
        >
          <span style={{ color: hasValue ? "var(--fg-primary)" : "var(--fg-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hasValue ? displayName : placeholder}
            {!selected && freeText && <span className="muted" style={{ fontStyle: "italic" }}> · sin registrar</span>}
          </span>
          {hasValue && (
            <X
              size={14}
              style={{ color: "var(--fg-tertiary)", flexShrink: 0 }}
              onClick={(e) => { e.stopPropagation(); onChange(""); onFreeText?.(""); }}
            />
          )}
        </button>
      )}

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-m)",
            boxShadow: "var(--shadow-elev)", maxHeight: 260, overflowY: "auto", padding: 4,
          }}
        >
          {allowFreeText && query.trim() && !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => { onFreeText?.(query.trim()); onChange(""); setOpen(false); setQuery(""); }}
              style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", border: 0, background: "transparent", borderRadius: "var(--radius-s)",
                cursor: "pointer", fontSize: 13, color: "var(--primary)", fontWeight: 600,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--orange-50)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <Plus size={14} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Usar «{query.trim()}» (sin registrar)</span>
            </button>
          )}
          {filtered.length === 0 ? (
            (allowFreeText && query.trim()) ? null : <div className="muted text-sm" style={{ padding: "10px 12px" }}>{emptyLabel}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", border: 0, background: o.id === value ? "var(--orange-50)" : "transparent",
                  borderRadius: "var(--radius-s)", cursor: "pointer", fontSize: 13,
                }}
                onMouseEnter={(e) => { if (o.id !== value) e.currentTarget.style.background = "var(--gray-50)"; }}
                onMouseLeave={(e) => { if (o.id !== value) e.currentTarget.style.background = "transparent"; }}
              >
                {o.id === value && <Check size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{o.name}</span>
                {o.hint && (
                  <span
                    title={o.hint}
                    style={{
                      flexShrink: 0, fontFamily: "var(--font-mono, ui-monospace, monospace)",
                      fontSize: 11, color: "var(--fg-tertiary)", background: "var(--gray-50)",
                      border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px",
                    }}
                  >
                    {shortHint(o.hint)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
