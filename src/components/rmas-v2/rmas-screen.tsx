"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2, RotateCcw, Laptop } from "lucide-react";
import { fetchRmas } from "@/server/actions/rmas";
import { RmaStatusBadge } from "@/components/proto/badges";
import { RmaDetailDrawer } from "./rma-detail-drawer";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import { formatRelativeTime } from "@/lib/utils/date-format";
import type { RmaRow } from "@/server/queries/rmas";

const STATUS_ORDER: RmaStatus[] = [
  "borrador", "solicitado", "aprobado", "enviado_proveedor", "en_proveedor", "devuelto", "recibido_oficina", "cerrado", "cancelado",
];

export function RmasScreen() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["rmas-v2"],
    queryFn: () => fetchRmas({ page: 1, pageSize: 500, sortBy: "createdAt", sortOrder: "desc" }),
  });

  const all: RmaRow[] = useMemo(() => data?.data ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of STATUS_ORDER) c[s] = all.filter((r) => r.status === s).length;
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    let arr = all.slice();
    if (status !== "all") arr = arr.filter((r) => r.status === status);
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((r) =>
        r.rmaNumber.toLowerCase().includes(q) ||
        (r.providerRmaNumber ?? "").toLowerCase().includes(q) ||
        (r.providerName ?? "").toLowerCase().includes(q) ||
        (r.deviceModel ?? "").toLowerCase().includes(q) ||
        (r.deviceSerialNumber ?? "").toLowerCase().includes(q) ||
        (r.incidentNumber ?? "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [all, status, query]);

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>RMAs</h1>
        <p>Autorizaciones de devolución a proveedor</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="search" style={{ flex: 1, maxWidth: 380 }}>
          <Search size={14} />
          <input placeholder="Buscar por ID, nº proveedor, modelo, serie, incidencia…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={() => router.push("/rmas/new")}>
          <Plus size={14} /> Nuevo RMA
        </button>
      </div>

      <div className="filterbar">
        <button className={`chip ${status === "all" ? "is-active" : ""}`} onClick={() => setStatus("all")}>
          Todos <span className="chip__count">{counts.all}</span>
        </button>
        {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <button key={s} className={`chip ${status === s ? "is-active" : ""}`} onClick={() => setStatus(s)}>
            {RMA_STATUS_LABELS[s]} <span className="chip__count">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="card empty">
          <RotateCcw size={28} color="var(--gray-400)" />
          <h4>Sin RMAs</h4>
          <div className="text-sm">Ajusta los filtros o crea un nuevo RMA.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table--dense">
            <thead>
              <tr>
                <th>ID interno</th>
                <th>Nº proveedor</th>
                <th>Proveedor</th>
                <th>Equipo</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Incidencia</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setSelectedId(r.id)}>
                  <td className="id-cell">{r.rmaNumber}</td>
                  <td className="mono text-sm fw-600">{r.providerRmaNumber || "—"}</td>
                  <td className="text-sm">{r.providerName ?? "—"}</td>
                  <td>
                    {r.deviceModel || r.deviceBrand ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Laptop size={14} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{[r.deviceBrand, r.deviceModel].filter(Boolean).join(" ")}</div>
                          {r.deviceSerialNumber && <div className="mono text-xs muted">{r.deviceSerialNumber}</div>}
                        </div>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="text-sm">{r.clientCompanyName ?? r.clientName ?? "—"}</td>
                  <td><RmaStatusBadge status={r.status} /></td>
                  <td className="id-cell">{r.incidentNumber ?? "—"}</td>
                  <td className="text-sm muted">{formatRelativeTime(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RmaDetailDrawer rmaId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
