"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2, Building2, ExternalLink } from "lucide-react";
import { fetchProviders } from "@/server/actions/providers";
import { fetchRmas } from "@/server/actions/rmas";

const CLOSED_RMA = ["cerrado", "cancelado"];

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function ProvidersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { data: provData, isLoading } = useQuery({
    queryKey: ["providers-v2"],
    queryFn: () => fetchProviders({ page: 1, pageSize: 500, sortBy: "name", sortOrder: "asc" }),
  });
  const { data: rmaData } = useQuery({
    queryKey: ["rmas-v2"],
    queryFn: () => fetchRmas({ page: 1, pageSize: 500, sortBy: "createdAt", sortOrder: "desc" }),
  });

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; active: number; devices: Set<string> }>();
    for (const r of rmaData?.data ?? []) {
      if (!r.providerId) continue;
      const s = m.get(r.providerId) ?? { total: 0, active: 0, devices: new Set<string>() };
      s.total++;
      if (!CLOSED_RMA.includes(r.status)) s.active++;
      const dk = (r.deviceSerialNumber?.trim() || `${r.deviceBrand ?? ""}|${r.deviceModel ?? ""}`).toLowerCase();
      if (dk.trim()) s.devices.add(dk);
      m.set(r.providerId, s);
    }
    return m;
  }, [rmaData]);

  const providers = useMemo(() => {
    let arr = provData?.data ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((p) => p.name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q));
    }
    return arr;
  }, [provData, query]);

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Proveedores</h1>
        <p>Fabricantes y distribuidores para RMA</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="search" style={{ flex: 1, maxWidth: 380 }}>
          <Search size={14} />
          <input placeholder="Buscar proveedor…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={() => router.push("/providers/new")}>
          <Plus size={14} /> Nuevo proveedor
        </button>
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : providers.length === 0 ? (
        <div className="card empty">
          <Building2 size={28} color="var(--gray-400)" />
          <h4>Sin proveedores</h4>
          <div className="text-sm">Crea un proveedor para empezar a gestionar RMAs.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {providers.map((p) => {
            const s = stats.get(p.id) ?? { total: 0, active: 0, devices: new Set() };
            return (
              <div key={p.id} className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => router.push(`/providers/${p.id}`)}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 44, height: 44, background: "var(--gray-900)", color: "#fff", borderRadius: 10, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                    {initials(p.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-700" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    {p.email && <div className="text-xs muted mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>}
                  </div>
                  {p.rmaUrl && (
                    <a href={p.rmaUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Portal RMA del proveedor" style={{ color: "var(--fg-tertiary)", flexShrink: 0 }}>
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 16 }}>
                  <div>
                    <div className="text-xs muted">Equipos</div>
                    <div className="fw-700 mono" style={{ fontSize: 18 }}>{s.devices.size}</div>
                  </div>
                  <div>
                    <div className="text-xs muted">RMA activos</div>
                    <div className="fw-700 mono" style={{ fontSize: 18, color: s.active ? "var(--primary)" : "inherit" }}>{s.active}</div>
                  </div>
                  <div>
                    <div className="text-xs muted">RMA total</div>
                    <div className="fw-700 mono" style={{ fontSize: 18 }}>{s.total}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
