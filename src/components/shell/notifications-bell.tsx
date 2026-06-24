"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Ticket, RotateCcw, Package, Clock, ArrowRight, ClipboardList } from "lucide-react";
import { fetchAlertItems } from "@/server/actions/alerts";
import { useDrawers } from "@/components/shell/drawers-provider";
import type { AlertItem } from "@/server/queries/alerts";

const TYPE_META: Record<AlertItem["type"], { icon: typeof Ticket; label: string }> = {
  incident_stale: { icon: Ticket, label: "Incidencia estancada" },
  rma_stuck_provider: { icon: RotateCcw, label: "RMA en proveedor" },
  rma_warehouse: { icon: Package, label: "RMA en almacén" },
  sla_warning: { icon: Clock, label: "SLA en riesgo" },
  support_submission: { icon: ClipboardList, label: "Soporte: nueva entrada" },
};

/** Campana de la topbar → centro de avisos. Reutiliza getAlertItems. */
export function NotificationsBell() {
  const { openByUrl } = useDrawers();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["alert-items"],
    queryFn: () => fetchAlertItems(),
    refetchInterval: 300_000,
    staleTime: 300_000,
  });

  const items = data?.items ?? [];
  const total = data?.totalCount ?? 0;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(url: string) {
    setOpen(false);
    // Incidencias y RMA abren su drawer; el resto (p.ej. /submissions) navega.
    if (/\/(incidents|rmas)\//.test(url)) openByUrl(url);
    else router.push(url);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn--ghost btn--icon" title="Avisos" onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        <Bell size={16} />
        {total > 0 && (
          <span style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--primary)", color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "16px", textAlign: "center", fontFamily: "var(--font-mono)" }}>
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 60, width: 380,
            background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-m)",
            boxShadow: "var(--shadow-elev)", maxHeight: 460, overflow: "hidden", display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="fw-700" style={{ fontSize: 14 }}>Avisos</span>
            <span className="muted text-xs">{total} que atender</span>
          </div>
          <div style={{ overflowY: "auto", padding: 4 }}>
            {isLoading ? (
              <div className="flex items-center justify-center muted text-sm" style={{ padding: 24, gap: 8 }}><Loader2 size={14} className="animate-spin" /> Cargando…</div>
            ) : items.length === 0 ? (
              <div className="muted text-sm" style={{ padding: 24, textAlign: "center" }}>Nada pendiente 🎉</div>
            ) : (
              items.map((it) => {
                const meta = TYPE_META[it.type];
                const Icon = meta.icon;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => go(it.entityUrl)}
                    style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px", border: 0, background: "transparent", borderRadius: "var(--radius-s)", cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gray-50)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, background: "var(--orange-50)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                      <Icon size={15} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{it.number}</span>
                        <span className="muted text-xs">{meta.label}</span>
                      </div>
                      <div className="text-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title ?? "—"}</div>
                    </div>
                    <span className="muted text-xs" style={{ flexShrink: 0 }}>{it.daysSinceChange}d</span>
                    <ArrowRight size={12} style={{ color: "var(--fg-tertiary)", flexShrink: 0 }} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
