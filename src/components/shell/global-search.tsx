"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, Loader2, Ticket, RotateCcw, ArrowRight } from "lucide-react";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { searchGlobal } from "@/server/actions/search";
import { tokenizeSearchInput } from "@/lib/utils/search-normalize";
import { useDrawers } from "@/components/shell/drawers-provider";

/**
 * Buscador global de la topbar (proto). Reutiliza la server action
 * `searchGlobal` y la tokenización existentes; solo cambia el markup a proto.
 * Atajo Ctrl/Cmd+K para enfocar.
 */
export function GlobalSearch() {
  const { openIncident, openRma } = useDrawers();
  const { inputValue, setInputValue, debouncedValue } = useDebouncedSearch(250);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const tokens = tokenizeSearchInput(debouncedValue);
  const hasValidQuery = tokens.length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ["global-search", tokens.join("|")],
    queryFn: () => searchGlobal(debouncedValue),
    enabled: hasValidQuery,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const incidents = data?.incidents ?? [];
  const rmas = data?.rmas ?? [];
  const hasResults = incidents.length > 0 || rmas.length > 0;

  useEffect(() => setOpen(hasValidQuery), [hasValidQuery]);

  // Cmd/Ctrl+K enfoca el buscador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cerrar al hacer click fuera.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(kind: "incident" | "rma", id: string) {
    setOpen(false);
    setInputValue("");
    if (kind === "incident") openIncident(id);
    else openRma(id);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, maxWidth: 420 }}>
      <div className="search" style={{ width: "100%" }}>
        <Search size={14} />
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => hasValidQuery && setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") { setInputValue(""); setOpen(false); inputRef.current?.blur(); } }}
          placeholder="Buscar incidencias, RMA…  (Ctrl/⌘K)"
        />
      </div>

      {open && hasValidQuery && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 60,
            background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-m)",
            boxShadow: "var(--shadow-elev)", maxHeight: 420, overflowY: "auto", padding: 4,
          }}
        >
          {isLoading && !data && (
            <div className="flex items-center justify-center muted text-sm" style={{ padding: 20, gap: 8 }}>
              <Loader2 size={14} className="animate-spin" /> Buscando…
            </div>
          )}

          {!isLoading && hasResults && (
            <>
              {incidents.length > 0 && <Group icon={<Ticket size={12} />} title="Incidencias" />}
              {incidents.map((inc) => (
                <ResultRow
                  key={inc.id}
                  number={inc.incidentNumber}
                  label={inc.title}
                  sub={[inc.clientCompanyName ?? inc.clientName, [inc.deviceBrand, inc.deviceModel].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                  onClick={() => go("incident", inc.id)}
                />
              ))}
              {rmas.length > 0 && <Group icon={<RotateCcw size={12} />} title="RMAs" />}
              {rmas.map((rma) => (
                <ResultRow
                  key={rma.id}
                  number={rma.rmaNumber}
                  label={rma.providerName ?? ""}
                  sub={[rma.clientCompanyName ?? rma.clientName, [rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" "), rma.incidentNumber].filter(Boolean).join(" · ")}
                  onClick={() => go("rma", rma.id)}
                />
              ))}
            </>
          )}

          {!isLoading && !hasResults && data && (
            <div className="muted text-sm" style={{ padding: 20, textAlign: "center" }}>
              Sin resultados para <span className="mono">“{debouncedValue}”</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="muted" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px 4px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {icon} {title}
    </div>
  );
}

function ResultRow({ number, label, sub, onClick }: { number: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="search-result"
      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: 0, background: "transparent", borderRadius: "var(--radius-s)", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gray-50)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>{number}</span>
          {label && <span className="text-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>}
        </div>
        {sub && <div className="muted" style={{ fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
      <ArrowRight size={12} style={{ color: "var(--fg-tertiary)", flexShrink: 0 }} />
    </button>
  );
}
