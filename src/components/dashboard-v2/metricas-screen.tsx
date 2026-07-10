"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
import { fetchSupportMetricsDashboard } from "@/server/actions/support-metrics";
import { upsertMetricReview } from "@/server/actions/rma-metric-reviews";
import {
  SUPPORT_METRIC_CATALOG,
  GROUP_LABELS,
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

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="ds-body-sm" style={{ color: "var(--gray-400)" }}>Sin datos en la semana.</p>;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "grid", gridTemplateColumns: "150px 1fr 44px", alignItems: "center", gap: 8 }}>
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

function Kpi({ label, value, sup, alert }: { label: string; value: string | number; sup?: string; alert?: boolean }) {
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

export function MetricasScreen() {
  const [weekParam, setWeekParam] = useQueryState("semana");
  const weekStart = weekParam || isoWeekStart(todayIso());

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["support-metrics-dashboard", weekStart],
    queryFn: () => fetchSupportMetricsDashboard(weekStart),
  });

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
      ["Grupo", "Métrica", "Objetivo", "Esta semana", "Semana anterior", "Responsable", "Estado", "Comentario"],
      SUPPORT_METRIC_CATALOG.map((m) => {
        const eff = effective(m.key);
        const owner = data.users.find((u) => u.id === eff.ownerUserId)?.name ?? "";
        return [
          GROUP_LABELS[m.group],
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
    const incAging = generateCSV(["Antigüedad incidencias", "Cantidad"], data.incidentAging.map((b) => [b.bucket, b.count]));
    const byStatus = generateCSV(["Estado RMA", "Cantidad"], data.rmaByStatus.map((s) => [s.label, s.count]));
    const outcomes = generateCSV(["Resultado RMA", "Cantidad"], data.rmaOutcomes.map((o) => [OUTCOME_LABELS[o.outcome] ?? o.outcome, o.count]));
    const csv = [report, "", "INCIDENCIAS POR ANTIGÜEDAD", incAging, "", "RMA POR ESTADO", byStatus, "", "RESULTADOS RMA", outcomes].join("\r\n");
    downloadCSV(csv, `metricas-soporte-${data.range.from}.csv`);
  }

  function exportPdf() {
    if (data) document.title = `Métricas soporte — semana ${data.range.from}`;
    window.print();
  }

  const gotoWeek = (deltaWeeks: number) => setWeekParam(addDaysIso(weekStart, deltaWeeks * 7));
  const thisWeek = isoWeekStart(todayIso());
  const v = data?.values ?? {};
  const p = data?.prevValues ?? {};

  return (
    <div className="stack" style={{ gap: 20 }}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* Cabecera */}
      <div className="row row--2-1" style={{ alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 className="ds-h2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={22} /> Métricas soporte
          </h1>
          <p className="ds-body-sm" style={{ color: "var(--gray-500)" }}>
            Reporte semanal del soporte de hardware (incidencias + RMA). {data ? fmtWeek(data.range.from, data.range.to) : "…"}
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

      {isLoading ? (
        <div className="card card--pad" style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : isError || !data ? (
        <div className="card card--pad" style={{ textAlign: "center", padding: 32 }}>
          <p className="ds-body" style={{ marginBottom: 12 }}>No se pudieron cargar las métricas.</p>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 size={14} className="animate-spin" /> : null} Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* KPIs Incidencias */}
          <div>
            <div className="ds-overline" style={{ marginBottom: 8 }}>Incidencias</div>
            <div className="kpi-grid">
              <Kpi label="Incidencias abiertas" value={v.inc_open ?? 0} sup="abiertas" />
              <Kpi label={`Incidencias >${7} días`} value={v.inc_aging_gt7 ?? 0} sup="aging" alert={(v.inc_aging_gt7 ?? 0) > 0} />
              <KpiDelta label="Cumplimiento SLA" value={v.inc_sla_compliance} prev={p.inc_sla_compliance} betterWhen="higher" unit="pct" />
              <KpiDelta label="Tiempo medio resolución" value={v.inc_avg_resolution_h} prev={p.inc_avg_resolution_h} betterWhen="lower" unit="h" />
            </div>
          </div>

          {/* KPIs RMA */}
          <div>
            <div className="ds-overline" style={{ marginBottom: 8 }}>RMA</div>
            <div className="kpi-grid">
              <Kpi label="RMA activos" value={data.rmaActive} sup="abiertos" />
              <Kpi label="RMA >7 días" value={v.rma_aging_gt7 ?? 0} sup="aging" alert={(v.rma_aging_gt7 ?? 0) > 0} />
              <KpiDelta label="Tiempo hasta tramitar" value={v.rma_time_to_solicitado} prev={p.rma_time_to_solicitado} betterWhen="lower" unit="h" />
              <KpiDelta label="% tramitados en objetivo" value={v.rma_solicitado_within_target} prev={p.rma_solicitado_within_target} betterWhen="higher" unit="pct" />
            </div>
          </div>

          {/* Tabla-reporte editable (incidencias + RMA) */}
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
                  {SUPPORT_METRIC_CATALOG.map((m, i) => {
                    const eff = effective(m.key);
                    const cur = data.values[m.key] ?? null;
                    const suggestion = suggestMetricStatus(m, cur);
                    const shown = (eff.status || suggestion || "") as RmaMetricStatus | "";
                    const showHeader = i === 0 || SUPPORT_METRIC_CATALOG[i - 1].group !== m.group;
                    return (
                      <Fragment key={m.key}>
                        {showHeader && (
                          <tr>
                            <td colSpan={7} style={{ background: "var(--gray-50, #f8f8f7)", fontWeight: 600, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.04em", color: "var(--gray-500)" }}>
                              {GROUP_LABELS[m.group]}
                            </td>
                          </tr>
                        )}
                        <tr>
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
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="row row--2">
            <div className="card card--pad">
              <div className="card__header"><strong>Incidencias por antigüedad</strong></div>
              <Bars data={data.incidentAging.map((b) => ({ label: b.bucket, value: b.count }))} />
            </div>
            <div className="card card--pad">
              <div className="card__header"><strong>RMA · reparto por estado</strong></div>
              <Bars data={data.rmaByStatus.map((s) => ({ label: s.label, value: s.count }))} />
            </div>
            <div className="card card--pad">
              <div className="card__header"><strong>RMA · resultados al cierre</strong></div>
              <Bars data={data.rmaOutcomes.map((o) => ({ label: OUTCOME_LABELS[o.outcome] ?? o.outcome, value: o.count }))} />
            </div>
            <div className="card card--pad">
              <div className="card__header"><strong>RMA · turnaround por proveedor (días)</strong></div>
              <Bars data={data.rmaProviderTurnaround.slice(0, 8).map((pr) => ({ label: pr.providerName, value: pr.avgDays }))} />
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
