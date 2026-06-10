"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, Laptop, Package } from "lucide-react";
import { fetchIncidents } from "@/server/actions/incidents";
import { fetchRmas } from "@/server/actions/rmas";
import { IncidentDetailDrawer } from "@/components/incidents-v2/incident-detail-drawer";
import { RmaDetailDrawer } from "@/components/rmas-v2/rma-detail-drawer";
import { formatRelativeTime } from "@/lib/utils/date-format";

const OPEN_INCIDENT = ["nuevo", "en_triaje", "en_gestion", "esperando_cliente", "esperando_proveedor", "esperando_pieza"];

interface DeviceAgg {
  key: string;
  type: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  client: string | null;
  provider: string | null;
  incidentIds: string[];
  openIncidents: number;
  rmaIds: string[];
  lastActivity: string; // ISO
}

export function InventarioScreen() {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [rmaId, setRmaId] = useState<string | null>(null);

  const { data: incData, isLoading: lo1 } = useQuery({
    queryKey: ["incidents-v2"],
    queryFn: () => fetchIncidents({ page: 1, pageSize: 500, sortBy: "updatedAt", sortOrder: "desc" }),
  });
  const { data: rmaData, isLoading: lo2 } = useQuery({
    queryKey: ["rmas-v2"],
    queryFn: () => fetchRmas({ page: 1, pageSize: 500, sortBy: "createdAt", sortOrder: "desc" }),
  });

  const isLoading = lo1 || lo2;

  const devices = useMemo<DeviceAgg[]>(() => {
    const map = new Map<string, DeviceAgg>();
    const keyOf = (brand: string | null, model: string | null, serial: string | null) =>
      (serial?.trim() || `${brand ?? ""}|${model ?? ""}`).toLowerCase();

    for (const i of incData?.data ?? []) {
      if (!i.deviceModel && !i.deviceBrand && !i.deviceSerialNumber) continue;
      const k = keyOf(i.deviceBrand, i.deviceModel, i.deviceSerialNumber);
      const agg = map.get(k) ?? { key: k, type: i.deviceType, brand: i.deviceBrand, model: i.deviceModel, serial: i.deviceSerialNumber, client: i.clientCompanyName ?? i.clientName, provider: null, incidentIds: [], openIncidents: 0, rmaIds: [], lastActivity: i.updatedAt as unknown as string };
      agg.incidentIds.push(i.id);
      if (OPEN_INCIDENT.includes(i.status)) agg.openIncidents++;
      if (!agg.client) agg.client = i.clientCompanyName ?? i.clientName;
      if (!agg.type) agg.type = i.deviceType;
      if (new Date(i.updatedAt) > new Date(agg.lastActivity)) agg.lastActivity = i.updatedAt as unknown as string;
      map.set(k, agg);
    }
    for (const r of rmaData?.data ?? []) {
      if (!r.deviceModel && !r.deviceBrand && !r.deviceSerialNumber) continue;
      const k = keyOf(r.deviceBrand, r.deviceModel, r.deviceSerialNumber);
      const agg = map.get(k) ?? { key: k, type: r.deviceType, brand: r.deviceBrand, model: r.deviceModel, serial: r.deviceSerialNumber, client: r.clientCompanyName ?? r.clientName, provider: r.providerName, incidentIds: [], openIncidents: 0, rmaIds: [], lastActivity: r.updatedAt as unknown as string };
      agg.rmaIds.push(r.id);
      if (!agg.provider) agg.provider = r.providerName;
      if (!agg.type) agg.type = r.deviceType;
      if (new Date(r.updatedAt) > new Date(agg.lastActivity)) agg.lastActivity = r.updatedAt as unknown as string;
      map.set(k, agg);
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }, [incData, rmaData]);

  const types = useMemo(() => Array.from(new Set(devices.map((d) => d.type).filter(Boolean))) as string[], [devices]);

  const filtered = useMemo(() => {
    let arr = devices.slice();
    if (filterType !== "all") arr = arr.filter((d) => d.type === filterType);
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((d) =>
        (d.model ?? "").toLowerCase().includes(q) ||
        (d.brand ?? "").toLowerCase().includes(q) ||
        (d.serial ?? "").toLowerCase().includes(q) ||
        (d.client ?? "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [devices, filterType, query]);

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Inventario</h1>
        <p>Equipos vistos en incidencias y RMAs</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="search" style={{ flex: 1, maxWidth: 380 }}>
          <Search size={14} />
          <input placeholder="Buscar por modelo, marca, serie, cliente…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto" }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">Todos los tipos</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {types.length > 0 && (
        <div className="kpi-grid">
          {types.map((t) => {
            const count = devices.filter((d) => d.type === t).length;
            return (
              <div key={t} className="kpi" style={{ cursor: "pointer" }} onClick={() => setFilterType(filterType === t ? "all" : t)}>
                <div className="kpi__label">{t}</div>
                <div className="kpi__value">{count}</div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="card empty">
          <Package size={28} color="var(--gray-400)" />
          <h4>Sin equipos</h4>
          <div className="text-sm">No hay equipos registrados en incidencias ni RMAs con esos filtros.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table--dense">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Serie</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Proveedor</th>
                <th>Incidencias</th>
                <th>RMAs</th>
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.key} onClick={() => { if (d.incidentIds[0]) setIncidentId(d.incidentIds[0]); else if (d.rmaIds[0]) setRmaId(d.rmaIds[0]); }}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Laptop size={14} />
                      <span className="fw-600">{[d.brand, d.model].filter(Boolean).join(" ") || "—"}</span>
                    </div>
                  </td>
                  <td className="mono text-xs">{d.serial || "—"}</td>
                  <td className="text-sm muted">{d.type || "—"}</td>
                  <td className="text-sm">{d.client || "—"}</td>
                  <td className="text-sm">{d.provider || "—"}</td>
                  <td>
                    {d.incidentIds.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="badge badge--gray">{d.incidentIds.length}</span>
                        {d.openIncidents > 0 && <span className="badge badge--orange">{d.openIncidents} abierta{d.openIncidents !== 1 ? "s" : ""}</span>}
                      </div>
                    ) : <span className="text-xs muted">—</span>}
                  </td>
                  <td>{d.rmaIds.length > 0 ? <span className="badge badge--purple">{d.rmaIds.length}</span> : <span className="text-xs muted">—</span>}</td>
                  <td className="text-sm muted">{formatRelativeTime(d.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IncidentDetailDrawer incidentId={incidentId} onClose={() => setIncidentId(null)} />
      <RmaDetailDrawer rmaId={rmaId} onClose={() => setRmaId(null)} />
    </div>
  );
}
