"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, X, Plus, Loader2, Laptop } from "lucide-react";
import { fetchArticlesForSelect, createArticle } from "@/server/actions/articles";

export interface ArticleOption {
  id: string;
  deviceType: string;
  brand: string;
  model: string;
}

interface Props {
  value: string; // articleId
  onSelect: (article: ArticleOption | null) => void;
  placeholder?: string;
}

function label(a: ArticleOption): string {
  return `${a.brand} ${a.model}${a.deviceType ? ` · ${a.deviceType}` : ""}`;
}

/**
 * Selector de equipo desde el catálogo `articles` (tipo/marca/modelo).
 * Habilita métricas fiables por modelo (guarda articleId). Permite alta
 * rápida si el equipo no está en el catálogo.
 */
export function ArticleCombobox({ value, onSelect, placeholder = "Buscar equipo en catálogo…" }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ deviceType: "", brand: "", model: "" });
  const ref = useRef<HTMLDivElement>(null);

  const { data: options = [] } = useQuery({
    queryKey: ["articles", "select"],
    queryFn: () => fetchArticlesForSelect(),
  });

  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); setCreating(false); }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => `${o.deviceType} ${o.brand} ${o.model}`.toLowerCase().includes(q))
      : options;
    return list.slice(0, 50);
  }, [options, query]);

  const createM = useMutation({
    mutationFn: () => createArticle(form),
    onSuccess: (a) => {
      if (!a) { toast.error("Completa tipo, marca y modelo"); return; }
      qc.invalidateQueries({ queryKey: ["articles", "select"] });
      onSelect(a);
      setOpen(false); setCreating(false); setQuery("");
      setForm({ deviceType: "", brand: "", model: "" });
    },
    onError: () => toast.error("Error al crear el artículo"),
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {open ? (
        <div className="search" style={{ width: "100%" }}>
          <Search size={14} />
          <input autoFocus placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      ) : (
        <button
          type="button"
          className="select"
          style={{ textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          onClick={() => setOpen(true)}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: selected ? "var(--fg-primary)" : "var(--fg-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected ? <><Laptop size={13} /> {label(selected)}</> : placeholder}
          </span>
          {selected && (
            <X size={14} style={{ color: "var(--fg-tertiary)", flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onSelect(null); }} />
          )}
        </button>
      )}

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-m)",
            boxShadow: "var(--shadow-elev)", maxHeight: 300, overflowY: "auto", padding: 4,
          }}
        >
          {creating ? (
            <div className="stack" style={{ gap: 8, padding: 8 }}>
              <input className="input" placeholder="Tipo (ej. TPV, impresora, tablet)" value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value })} autoFocus />
              <input className="input" placeholder="Marca" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              <input className="input" placeholder="Modelo" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn--ghost btn--sm" onClick={() => setCreating(false)}>Cancelar</button>
                <button className="btn btn--primary btn--sm" onClick={() => createM.mutate()} disabled={createM.isPending}>
                  {createM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Añadir al catálogo
                </button>
              </div>
            </div>
          ) : (
            <>
              {filtered.length === 0 ? (
                <div className="muted text-sm" style={{ padding: "10px 12px" }}>Sin coincidencias en el catálogo</div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { onSelect(o); setOpen(false); setQuery(""); }}
                    style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: 0, background: o.id === value ? "var(--orange-50)" : "transparent", borderRadius: "var(--radius-s)", cursor: "pointer", fontSize: 13 }}
                    onMouseEnter={(e) => { if (o.id !== value) e.currentTarget.style.background = "var(--gray-50)"; }}
                    onMouseLeave={(e) => { if (o.id !== value) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Laptop size={13} style={{ flexShrink: 0, color: "var(--fg-tertiary)" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.brand} {o.model}</span>
                    <span className="muted" style={{ marginLeft: "auto", flexShrink: 0, fontSize: 11 }}>{o.deviceType}</span>
                  </button>
                ))
              )}
              <button
                type="button"
                onClick={() => { setCreating(true); setForm({ deviceType: "", brand: "", model: query.trim() }); }}
                style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: 0, borderTop: "1px solid var(--border-light, var(--border))", background: "transparent", color: "var(--primary)", cursor: "pointer", fontSize: 13, fontWeight: 600, marginTop: 4 }}
              >
                <Plus size={14} /> Añadir equipo nuevo al catálogo
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
