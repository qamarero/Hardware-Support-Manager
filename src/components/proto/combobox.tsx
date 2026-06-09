"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Check, X } from "lucide-react";

export interface ComboOption {
  id: string;
  name: string;
}

interface ComboboxProps {
  options: ComboOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}

/**
 * Combobox con búsqueda de texto (estilo prototipo). Filtra en cliente —
 * adecuado para listas grandes (p.ej. 1500 clientes) cargadas como id+name.
 */
export function Combobox({ options, value, onChange, placeholder = "Buscar…", emptyLabel = "Sin resultados" }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

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
    const list = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
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
          <span style={{ color: selected ? "var(--fg-primary)" : "var(--fg-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected ? selected.name : placeholder}
          </span>
          {selected && (
            <X
              size={14}
              style={{ color: "var(--fg-tertiary)", flexShrink: 0 }}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
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
          {filtered.length === 0 ? (
            <div className="muted text-sm" style={{ padding: "10px 12px" }}>{emptyLabel}</div>
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
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
