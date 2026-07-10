"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  BarChart3,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { fetchRmaMetricsDashboard } from "@/server/actions/rma-metrics";
import { upsertMetricReview } from "@/server/actions/rma-metric-reviews";
import {
  RMA_METRIC_CATALOG,
  RMA_AGING_THRESHOLD_DAYS,
  suggestMetricStatus,
  formatMetricValue,
  type RmaMetricStatus,
} from "@/lib/constants/rma-metrics";
import { addDaysIso, isoWeekStart, todayIso } from "@/lib/utils/date-periods";
import { generateCSV, downloadCSV } from "@/lib/utils/csv-export";

const OUTCOME_LABELS: Record<string, string> = {
  reparado: "Reparado",
  sustituido: "Sustituido",
  abono: "Abono",
  rechazado: "Rechazado",
  sin_solucion: "Sin solución",
  sustitucion_directa: "Sustitución directa",
};

const STATUS_LABELS: Record<string, string> = {
  verde: "🟢 En objetivo",
  ambar: "🟡 Atención",
  rojo: "🔴 Fuera",
};

const STATUS_DOT: Record<string, string> = {
  verde: "var(--green, #16a34a)",
  ambar: "var(--amber, #d97706)",
  rojo: "var(--red, #dc2626)",
};

type Draft = { status: string; ownerUserId: string; comment: string };

function fmtWeek(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", timeZone: "UTC" };
  return `${f.toLocaleDateString("es-ES", opts)} – ${t.toLocaleDateString("es-ES", opts)}`;
}

/** Delta con flecha para KPIs (respeta el sentido: menos es mejor / más es mejor). */
function Delta({
  current,
  previous,
  betterWhen,
  unit,
}: {
  current: number | null;
  previous: number | null;
  betterWhen: "lower" | "higher" | "info";
  unit: string;
}) {
  if (current === null || previous === null) {
    return <span className="kpi__delta kpi__delta--flat"><Minus size={12} /> sin comparación</span>;
  }
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return <span className="kpi__delta kpi__delta--flat"><Minus size={12} /> igual</span>;
  const up = diff > 0;
  const good = betterWhen === "info" ? null : betterWhen === "higher" ? up : !up;
  const cls = good === null ? "kpi__delta--flat" : good ? "kpi__delta--up" : "kpi__delta--down";
  return (
    <span className={`kpi__delta ${cls}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {Math.abs(diff)}
      {unit === "pct" ? " pts" : ""} vs. sem. ant.
    </span>
  );
}

/** Barras horizontales simples (proto, sin librería). */
function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="ds-body-sm" style={{ color: "var(--gray-400)" }}>Sin datos en la semana.</p>;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "grid", gridTemplateColumns: "140px 1fr 40px", alignItems: "center", gap: 8 }}>
          <span className="ds-body-sm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
          <span style={{ background: "var(--gray-100)", borderRadius: 4, height: 14 }}>
            <span style={{ display: "block", width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 4 : 0, height: 14, background: "var(--primary, #ff7a1a)", borderRadius: 4 }} />
          </span>
          <span className="ds-num ds-body-sm" style={{ textAlign: "right" }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

const PRINT_CSS = `
@media print {
  .sidebar, .topbar, .no-print { display: none !important; }
  .app, .main { display: block !important; }
  .page { padding: 0 !important; }
  .card { break-inside: avoid; box-shadow: none !important; border: 1px solid #ddd !important; }
  .print-only { display: block !important; }
  @page { margin: 12mm; size: A4 portrait; }
}
.print-only { display: none; }
`;

export function RmaMetricasScreen() {
  const [weekParam, setWeekParam] = useQueryState("semana");
  const weekStart = weekParam || isoWeekStart(todayIso());

  const { data, isLoading } = useQuery({
    queryKey: ["rma-metrics-dashboard", weekStart],
    queryFn: () => fetchRmaMetricsDashboard(weekStart),
  });

  // Anotaciones locales (semáforo/responsable/comentario) sobre lo que hay en BD.
  const [edits, setEdits] = useState<Record<string, Partial<Draft>>>({});
  useEffect(() => {
    setEdits({});
  }, [weekStart]);

  const reviewMap = useMemo(() => {
    const m: Record<string, { status: string | null; ownerUserId: string | null; comment: string | null }> = {};
    for (const r of data?.reviews ?? []) m[r.metricKey] = r;
    return m;
  }, [data]);

  const effective = (key: string): Draft => ({
    status: edits[key]?.status ?? reviewMap[key]?.status ?? "",
    ownerUserId: edits[key]?.ownerUserId ?? reviewMap[key]?.ownerUserId ?? "",
    comment: edits[key]?.comment ?? reviewMap[key]?.comment ?? "",
  });

  const saveM = useMutation({
    mutationFn: (v: { metricKey: string } & Draft) =>
      upsertMetricReview({
        metricKey: v.metricKey,
        weekStart,
        status: v.status || null,
        ownerUserId: v.ownerUserId || null,
        comment: v.comment || null,
      }),
    onSuccess: (r) => {
      if (!r.success) toast.error(r.error);
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const patch = (key: string, p: Partial<Draft>, save = true) => {
    const merged = { ...effective(key), ...p };
    setEdits((prev) => ({ ...prev, [key]: merged }));
    if (save) saveM.mutate({ metricKey: key, ...merged });
  };

  function exportCsv() {
    if (!data) return;
    const report = generateCSV(
      ["Métrica", "Objetivo", "Esta semana", "Semana anterior", "Responsable", "Estado", "Comentario"],
      RMA_METRIC_CATALOG.map((m) => {
        const eff = effective(m.key);
        const owner = data.users.find((u) => u.id === eff.ownerUserId)?.name ?? "";
        return [
          m.label,
          m.target !== null ? formatMetricValue(m.unit, m.target) : "",
          formatMetricValue(m.unit, data.values[m.key] ?? null),
          formatMetricValue(m.unit, data.prevValues[m.key] ?? null),
          owner,
          eff.status ? STATUS_LABELS[eff.status]?.replace(/^\W+\s/, "") ?? eff.status : "",
          eff.comment,
        ];
      }),
    );
    const byStatus = generateCSV(["Estado", "Cantidad"], data.byStatus.map((s) => [s.label, s.count]));
    const outcomes = generateCSV(
      ["Resultado", "Cantidad"],
      data.outcomes.map((o) => [OUTCOME_LABELS[o.outcome] ?? o.outcome, o.count]),
    );
    const csv = [report, "", "REPARTO POR ESTADO", byStatus, "", "RESULTADOS AL CIERRE", outcomes].join("\r\n");
    downloadCSV(csv, `metricas-rma-${data.range.from}.csv`);
  }

  function exportPdf() {
    if (data) document.title = `Métricas RMA — semana ${data.range.from}`;
    window.print();
  }

  const gotoWeek = (deltaWeeks: number) => setWeekParam(addDaysIso(weekStart, deltaWeeks * 7));
  const thisWeek = isoWeekStart(todayIso());

  return (
    <div className="stack" style={{ gap: 20 }}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* Cabecera */}
      <div className="row row--2-1" style={{ alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 className="ds-h2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={22} /> Métricas RMA
          </h1>
          <p className="ds-body-sm" style={{ color: "var(--gray-500)" }}>
            Reporte semanal de RMA. {data ? fmtWeek(data.range.from, data.range.to) : "…"}
          </p>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <div className="seg" role="group" aria-label="Semana">
            <button type="button" className="btn btn--outline btn--icon btn--sm" onClick={() => gotoWeek(-1)} title="Semana anterior"><ChevronLeft size={14} /></button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setWeekParam(null)} disabled={weekStart === thisWeek}>Esta semana</button>
            <button type="button" className="btn btn--outline btn--icon btn--sm" onClick={() => gotoWeek(1)} disabled={weekStart >= thisWeek} title="Semana siguiente"><ChevronRight size={14} /></button>
          </div>
          <button type="button" className="btn btn--outline btn--sm" onClick={exportCsv} disabled={!data}><Download size={14} /> CSV</button>
          <button type="button" className="btn btn--primary btn--sm" onClick={exportPdf} disabled={!data}><Printer size={14} /> PDF</button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="card card--pad" style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="kpi-grid">
            <Kpi label="RMA activos" value={data.aging.openTotal} sup="abiertos" />
            <Kpi label={`RMA >${RMA_AGING_THRESHOLD_DAYS} días`} value={data.aging.gt7d} sup="aging" alert={data.aging.gt7d > 0} />
            <KpiDelta label="Cambios de estado" value={data.values.rma_state_changes} prev={data.prevValues.rma_state_changes} betterWhen="info" unit="count" />
            <KpiDelta label="Solicitudes tramitadas" value={data.values.rma_solicitudes} prev={data.prevValues.rma_solicitudes} betterWhen="info" unit="count" />
            <KpiDelta label="Tiempo hasta tramitar" value={data.values.rma_time_to_solicitado} prev={data.prevValues.rma_time_to_solicitado} betterWhen="lower" unit="h" />
            <KpiDelta label="% tramitados en objetivo" value={data.values.rma_solicitado_within_target} prev={data.prevValues.rma_solicitado_within_target} betterWhen="higher" unit="pct" />
          </div>

          {/* Tabla-reporte editable */}
          <div className="card">
            <div className="card__header"><strong>Reporte semanal</strong></div>
            <div className="table-wrap">
              <table className="table table--dense">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th>Objetivo</th>
                    <th>Esta semana</th>
                    <th>Semana anterior</th>
                    <th>Responsable</th>
                    <th>Estado</th>
                    <th>Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {RMA_METRIC_CATALOG.map((m) => {
                    const eff = effective(m.key);
                    const cur = data.values[m.key] ?? null;
                    const suggestion = suggestMetricStatus(m, cur);
                    const shown = (eff.status || suggestion || "") as RmaMetricStatus | "";
                    return (
                      <tr key={m.key}>
                        <td title={m.description}>{m.label}</td>
                        <td className="mono">{m.target !== null ? formatMetricValue(m.unit, m.target) : "—"}</td>
                        <td className="num mono"><strong>{formatMetricValue(m.unit, cur)}</strong></td>
                        <td className="num mono" style={{ color: "var(--gray-500)" }}>{formatMetricValue(m.unit, data.prevValues[m.key] ?? null)}</td>
                        <td>
                          <select className="select" value={eff.ownerUserId} onChange={(e) => patch(m.key, { ownerUserId: e.target.value })}>
                            <option value="">—</option>
                            {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: shown ? STATUS_DOT[shown] : "var(--gray-300)", flex: "0 0 auto" }} />
                            <select className="select" value={eff.status} onChange={(e) => patch(m.key, { status: e.target.value })} title={!eff.status && suggestion ? `Sugerido: ${STATUS_LABELS[suggestion]}` : undefined}>
                              <option value="">{suggestion ? `Auto (${suggestion})` : "Auto"}</option>
                              <option value="verde">🟢 En objetivo</option>
                              <option value="ambar">🟡 Atención</option>
                              <option value="rojo">🔴 Fuera</option>
                            </select>
                          </span>
                        </td>
                        <td style={{ minWidth: 200 }}>
                          <input
                            className="input"
                            placeholder="Comentario opcional"
                            value={eff.comment}
                            onChange={(e) => patch(m.key, { comment: e.target.value }, false)}
                            onBlur={() => saveM.mutate({ metricKey: m.key, ...effective(m.key) })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="row row--2">
            <div className="card card--pad">
              <div className="card__header"><strong>Reparto por estado</strong></div>
              <Bars data={data.byStatus.map((s) => ({ label: s.label, value: s.count }))} />
            </div>
            <div className="card card--pad">
              <div className="card__header"><strong>Cambios de estado por día</strong></div>
              <Bars data={data.stateChanges.byDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} />
            </div>
            <div className="card card--pad">
              <div className="card__header"><strong>Resultados al cierre</strong></div>
              <Bars data={data.outcomes.map((o) => ({ label: OUTCOME_LABELS[o.outcome] ?? o.outcome, value: o.count }))} />
            </div>
            <div className="card card--pad">
              <div className="card__header"><strong>Turnaround por proveedor (días)</strong></div>
              <Bars data={data.providerTurnaround.slice(0, 8).map((p) => ({ label: p.providerName, value: p.avgDays }))} />
            </div>
          </div>

          <p className="ds-body-sm print-only" style={{ color: "var(--gray-500)", marginTop: 8 }}>
            Generado desde Hardware Support Manager · {fmtWeek(data.range.from, data.range.to)}
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sup, alert }: { label: string; value: number; sup?: string; alert?: boolean }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}{sup ? <sup>{sup}</sup> : null}</div>
      {alert ? <div className="kpi__delta kpi__delta--down">requiere atención</div> : <div className="kpi__delta kpi__delta--flat">snapshot</div>}
    </div>
  );
}

function KpiDelta({
  label,
  value,
  prev,
  betterWhen,
  unit,
}: {
  label: string;
  value: number | null;
  prev: number | null;
  betterWhen: "lower" | "higher" | "info";
  unit: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{formatMetricValue(unit as "h" | "count" | "pct", value)}</div>
      <Delta current={value} previous={prev} betterWhen={betterWhen} unit={unit} />
    </div>
  );
}
