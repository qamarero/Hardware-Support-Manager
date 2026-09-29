"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Check, X, Plus, Loader2 } from "lucide-react";

export interface ComboOption {
  id: string;
  name: string;
  /** Texto secundario (p.ej. ID del cliente). Se muestra y es buscable. */
  hint?: string | null;
  /**
   * Los tres campos siguientes convierten la fila en una tarjeta de varias
   * líneas. Son opcionales: sin ellos la opción se pinta como siempre, que es
   * lo que siguen haciendo los demás usos del combobox.
   */
  /** Segunda línea: ciudad, provincia, correo… lo que ayude a reconocerlo. */
  subtitle?: string | null;
  /** Identificador largo, en monoespaciada y a línea completa. */
  code?: string | null;
  /** Etiqueta de estado, p.ej. «de baja». */
  badge?: string | null;
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
  /**
   * Avisa de lo que se va escribiendo, para buscar en el servidor.
   * Al pasarlo, `options` se asume ya filtrada y no se vuelve a filtrar aquí.
   */
  onQueryChange?: (query: string) => void;
  /** Hay una búsqueda en vuelo (solo con `onQueryChange`). */
  loading?: boolean;
  /** Caracteres mínimos antes de buscar. Solo informativo para el mensaje. */
  minQueryLength?: number;
  /**
   * Salida que se ofrece SOLO cuando la búsqueda no devuelve nada. Deliberado:
   * un escape siempre visible compite con el buscador y acaba usándose por
   * atajo.
   */
  emptyAction?: { label: string; onClick: () => void };
}

/**
 * Combobox con búsqueda de texto (estilo prototipo). Filtra en cliente —
 * adecuado para listas grandes (p.ej. ~3700 clientes) cargadas como id+name.
 * Con `allowFreeText`, si lo escrito no coincide con ninguna opción se puede
 * usar como texto libre (`onFreeText`) en vez de obligar a elegir de la lista.
 */
export function Combobox({ options, value, onChange, placeholder = "Buscar…", emptyLabel = "Sin resultados", allowFreeText = false, freeText = "", onFreeText, onQueryChange, loading = false, minQueryLength = 2, emptyAction }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  /** Con búsqueda en servidor, `options` ya viene filtrada: filtrar otra vez
   *  sobre un tramo parcial escondería resultados que el servidor sí encontró. */
  const serverSide = !!onQueryChange;

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
    if (serverSide) return options;
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            (o.hint ?? "").toLowerCase().includes(q)
        )
      : options;
    return list.slice(0, 50); // limitar render
  }, [options, query, serverSide]);

  function handleQuery(next: string) {
    setQuery(next);
    onQueryChange?.(next);
  }

  /** ¿Alguna opción trae datos de tarjeta? Decide el ancho del desplegable. */
  const hayTarjetas = filtered.some((o) => o.subtitle || o.code || o.badge);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {open ? (
        <div className="search" style={{ width: "100%" }}>
          <Search size={14} />
          <input
            autoFocus
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
          />
          {loading && <Loader2 size={13} className="animate-spin" style={{ color: "var(--fg-tertiary)", flexShrink: 0 }} />}
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
            boxShadow: "var(--shadow-elev)",
            // Las tarjetas necesitan aire: el campo del formulario es estrecho
            // y el restaurant_id es un UUID de 36 caracteres. Se desborda hacia
            // la derecha del campo, acotado a la pantalla para no salirse en
            // móvil. Sin tarjetas se queda del ancho del campo, como siempre.
            ...(hayTarjetas
              ? { minWidth: "min(460px, calc(100vw - 48px))", maxHeight: 340 }
              : { maxHeight: 260 }),
            overflowY: "auto", padding: 4,
          }}
        >
          {allowFreeText && query.trim() && !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => { onFreeText?.(query.trim()); onChange(""); setOpen(false); handleQuery(""); }}
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
            // Con búsqueda en servidor hay que distinguir tres situaciones que
            // un «Sin resultados» a secas confunde: aún no has escrito bastante,
            // se está buscando, o de verdad no hay nada.
            serverSide && query.trim().length < minQueryLength ? (
              <div className="muted text-sm" style={{ padding: "10px 12px" }}>
                Escribe al menos {minQueryLength} letras para buscar
              </div>
            ) : serverSide && loading ? (
              <div className="muted text-sm" style={{ padding: "10px 12px" }}>Buscando…</div>
            ) : (allowFreeText && query.trim()) ? null : (
              <>
                <div className="muted text-sm" style={{ padding: "10px 12px" }}>
                  {emptyLabel}{query.trim() ? ` con «${query.trim()}»` : ""}.
                </div>
                {emptyAction && (
                  <button
                    type="button"
                    onClick={() => { setOpen(false); handleQuery(""); emptyAction.onClick(); }}
                    style={{
                      width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 12px", border: 0, borderTop: "1px solid var(--border)",
                      background: "transparent", borderRadius: 0, cursor: "pointer",
                      fontSize: 13, color: "var(--primary)", fontWeight: 600,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--orange-50)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Plus size={14} style={{ flexShrink: 0 }} />
                    <span>{emptyAction.label}</span>
                  </button>
                )}
              </>
            )
          ) : (
            filtered.map((o) => {
              const esTarjeta = !!(o.subtitle || o.code || o.badge);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onChange(o.id); setOpen(false); handleQuery(""); }}
                  style={{
                    width: "100%", textAlign: "left", display: "flex",
                    alignItems: esTarjeta ? "flex-start" : "center", gap: 8,
                    padding: esTarjeta ? "9px 10px" : "8px 10px", border: 0,
                    background: o.id === value ? "var(--orange-50)" : "transparent",
                    borderRadius: "var(--radius-s)", cursor: "pointer", fontSize: 13,
                  }}
                  onMouseEnter={(e) => { if (o.id !== value) e.currentTarget.style.background = "var(--gray-50)"; }}
                  onMouseLeave={(e) => { if (o.id !== value) e.currentTarget.style.background = "transparent"; }}
                >
                  {o.id === value && (
                    <Check size={14} style={{ color: "var(--primary)", flexShrink: 0, marginTop: esTarjeta ? 2 : 0 }} />
                  )}

                  {esTarjeta ? (
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {/* 700 y color primario explícito: al oscurecer el
                            subtítulo y el identificador para que se leyeran,
                            el nombre dejaba de destacar sobre ellos. */}
                        <span style={{
                          fontWeight: 700, color: "var(--fg-primary)", fontSize: 13.5,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {o.name}
                        </span>
                        {o.badge && (
                          <span style={{
                            flexShrink: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                            letterSpacing: ".03em", color: "var(--gray-700)", background: "var(--gray-100)",
                            border: "1px solid var(--border)", borderRadius: 999, padding: "1px 7px",
                          }}>
                            {o.badge}
                          </span>
                        )}
                      </span>
                      {/* gray-700 y no fg-tertiary: este último es #9e9e9e, que
                          sobre blanco da 2,8:1 de contraste y en pantallas
                          malas o con mucho brillo no se lee. gray-700 (#616161)
                          da 5,9:1, por encima del mínimo accesible de 4,5:1. */}
                      {o.subtitle && (
                        <span style={{ fontSize: 12.5, color: "var(--gray-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {o.subtitle}
                        </span>
                      )}
                      {o.code && (
                        // Completo y seleccionable: sirve para cotejarlo contra
                        // CX Advisor, y truncado no valdría para eso.
                        <span style={{
                          fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11.5,
                          color: "var(--gray-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {o.code}
                        </span>
                      )}
                    </span>
                  ) : (
                    <>
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
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
