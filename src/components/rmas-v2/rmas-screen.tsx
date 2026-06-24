"use client";

import { Fragment, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2, RotateCcw, Laptop } from "lucide-react";
import { fetchRmas } from "@/server/actions/rmas";
import { RmaStatusBadge } from "@/components/proto/badges";
import { CopyId } from "@/components/proto/copy-id";
import { RmaDetailDrawer } from "./rma-detail-drawer";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import { CLOSED_RMA_STATUSES } from "@/lib/constants/statuses";
import { formatRelativeTime } from "@/lib/utils/date-format";
import type { RmaRow } from "@/server/queries/rmas";

// Estados activos arriba; cerrados (entregado/rechazado/cerrado/cancelado) en su sección.
const STATUS_ORDER: RmaStatus[] = [
  "borrador", "solicitado", "aprobado", "enviado_proveedor", "en_proveedor", "devuelto", "recibido_oficina", "entregado_cliente", "rechazado", "cerrado", "cancelado",
];

const CLOSED_RMA = new Set<string>(CLOSED_RMA_STATUSES);
const isRmaClosed = (s: string) => CLOSED_RMA.has(s);

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
    arr.sort((a, b) => {
      // En "Todos", activos arriba y cerrados/finalizados abajo.
      if (status === "all") {
        const ga = isRmaClosed(a.status) ? 1 : 0;
        const gb = isRmaClosed(b.status) ? 1 : 0;
        if (ga !== gb) return ga - gb;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return arr;
  }, [all, status, query]);

  // Índice del primer RMA cerrado: ahí va el divisor visual.
  const firstClosedIdx = useMemo(
    () => (status === "all" ? filtered.findIndex((r) => isRmaClosed(r.status)) : -1),
    [filtered, status]
  );
  const showDivider = firstClosedIdx > 0;

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
              {filtered.map((r, idx) => (
                <Fragment key={r.id}>
                {showDivider && idx === firstClosedIdx && (
                  <tr className="row-divider" aria-hidden>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 6px", color: "var(--gray-500)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                          Finalizados
                        </span>
                        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{filtered.length - firstClosedIdx}</span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr onClick={() => setSelectedId(r.id)} style={isRmaClosed(r.status) ? { opacity: 0.6 } : undefined}>
                  <td className="id-cell"><CopyId value={r.rmaNumber} /></td>
                  <td className="mono text-sm fw-600">{r.providerRmaNumber ? <CopyId value={r.providerRmaNumber} /> : "—"}</td>
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
                  <td className="id-cell">{r.incidentNumber ? <CopyId value={r.incidentNumber} /> : "—"}</td>
                  <td className="text-sm muted">{formatRelativeTime(r.updatedAt)}</td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RmaDetailDrawer rmaId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
