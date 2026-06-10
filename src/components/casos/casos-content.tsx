"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryState, parseAsStringEnum } from "nuqs";
import { Loader2, RotateCcw, ArrowRight, Layers } from "lucide-react";
import { IncidentStatusBadge } from "@/components/proto/badges";
import { IncidentDetailDrawer } from "@/components/incidents-v2/incident-detail-drawer";
import { RmaDetailDrawer } from "@/components/rmas-v2/rma-detail-drawer";
import { CaseStepper } from "./case-stepper";
import { fetchCasos } from "@/server/actions/casos";
import type { CasoFilter } from "@/server/queries/casos";

const FILTERS: { value: CasoFilter; label: string }[] = [
  { value: "activos", label: "Activos" },
  { value: "con_rma", label: "Con RMA" },
  { value: "sin_rma", label: "Sin RMA" },
  { value: "todos", label: "Todos" },
];

export function CasosContent() {
  const [filter, setFilter] = useQueryState(
    "filtro",
    parseAsStringEnum<CasoFilter>(["activos", "con_rma", "sin_rma", "todos"]).withDefault("activos")
  );
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [rmaId, setRmaId] = useState<string | null>(null);

  const { data: casos = [], isLoading } = useQuery({
    queryKey: ["casos", filter],
    queryFn: () => fetchCasos(filter),
  });

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Casos</h1>
        <p>Pipeline unificado: cada incidencia con su RMA vinculado</p>
      </div>

      <div className="filterbar">
        {FILTERS.map((f) => (
          <button key={f.value} className={`chip ${filter === f.value ? "is-active" : ""}`} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando casos…</span></div>
      ) : casos.length === 0 ? (
        <div className="card empty">
          <Layers size={28} color="var(--gray-400)" />
          <h4>Sin casos</h4>
          <div className="text-sm">No hay casos para este filtro.</div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {casos.map((c) => {
            const rmaBack = c.rma && ["devuelto", "recibido_oficina", "cerrado"].includes(c.rma.status);
            const showCloseBanner = rmaBack && c.status === "esperando_pieza";
            return (
              <div key={c.incidentId} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button className="id-cell" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--primary)" }} onClick={() => setIncidentId(c.incidentId)}>
                    {c.incidentNumber}
                  </button>
                  <IncidentStatusBadge status={c.status} />
                  {c.rma && (
                    <button className="badge badge--outline" style={{ cursor: "pointer" }} onClick={() => setRmaId(c.rma!.id)}>
                      <ArrowRight size={12} /> {c.rma.rmaNumber}
                    </button>
                  )}
                </div>
                <div className="text-sm" style={{ marginTop: 6, fontWeight: 600 }}>{c.title}</div>
                {c.clientName && <div className="text-xs muted" style={{ marginBottom: 10 }}>{c.clientName}</div>}

                <div style={{ marginTop: 10 }}>
                  <CaseStepper incidentStatus={c.status} rmaStatus={c.rma?.status ?? null} />
                </div>

                {showCloseBanner && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--green-50)", border: "1px solid var(--green-500)", fontSize: 13 }}>
                    <span style={{ color: "var(--green-900)" }}>El RMA ya está de vuelta — la incidencia puede cerrarse.</span>
                    <button className="btn btn--secondary btn--sm" onClick={() => setIncidentId(c.incidentId)}>
                      Abrir incidencia <ArrowRight size={12} />
                    </button>
                  </div>
                )}

                {!c.rma && !["resuelto", "cerrado", "cancelado"].includes(c.status) && (
                  <div className="text-xs muted" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <RotateCcw size={12} /> Sin RMA — derívalo desde la ficha de la incidencia si procede.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <IncidentDetailDrawer incidentId={incidentId} onClose={() => setIncidentId(null)} />
      <RmaDetailDrawer rmaId={rmaId} onClose={() => setRmaId(null)} />
    </div>
  );
}
