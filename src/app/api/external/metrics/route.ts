import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { requireMainPortalAuth } from "@/lib/external-auth";
import {
  getDashboardStats,
  getSlaMetrics,
  getAgingDistribution,
  getQuickConsultationsStats,
} from "@/server/queries/dashboard";
import {
  getProviderRmaVolume,
  getProviderSuccessRate,
  getProviderRmaTurnaround,
} from "@/server/queries/analytics";

/**
 * GET /api/external/metrics
 *
 * Endpoint público consumido por el HW Main Portal. Auth con header
 * `X-API-Key` validado contra `process.env.MAIN_PORTAL_API_KEY` con
 * `crypto.timingSafeEqual` (mitiga timing attacks).
 *
 * Query params:
 *   - from: YYYY-MM-DD (default: hace 30 días)
 *   - to: YYYY-MM-DD (default: hoy)
 *
 * Calcula AUTOMÁTICAMENTE el periodo anterior equivalente (mismo nº de días
 * justo antes de `from`) para que el portal pueda mostrar el delta MoM
 * sin un segundo round-trip.
 *
 * Cache: 60s en `unstable_cache` (revalidate + tag) → si el mismo rango se
 * pide de nuevo dentro de la ventana, devuelve la copia cacheada.
 *
 * Response shape: ver `docs/connectors/hsm-endpoint-spec.md` (sección 5)
 * en el repo `Hw Main Portal`.
 *
 * Reusa queries existentes (NO duplica lógica):
 *   - getDashboardStats / getSlaMetrics / getAgingDistribution → src/server/queries/dashboard.ts
 *   - getProviderRmaVolume / getProviderSuccessRate / getProviderRmaTurnaround → src/server/queries/analytics.ts
 *
 * Calcula inline (no expuesto en otras queries):
 *   - throughput_ratio = (cerradas en periodo) / (creadas en periodo)
 *   - critical_in_sla_pct = % críticas resueltas en ≤8h en el periodo
 */

export const runtime = "nodejs"; // crypto.timingSafeEqual requiere Node runtime
export const dynamic = "force-dynamic"; // depende de query params + headers

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Mapeo de buckets aging — del label español interno al enum del spec del portal. */
const AGING_BUCKET_MAP: Record<string, "lt_1d" | "1_3d" | "3_7d" | "gt_7d"> = {
  "< 1 día": "lt_1d",
  "1-3 días": "1_3d",
  "3-7 días": "3_7d",
  "7+ días": "gt_7d",
};

interface PeriodStrings {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

/**
 * Calcula el periodo anterior equivalente (mismo número de días justo antes
 * de `from`). Trabaja en UTC para evitar saltos de DST. Devuelve strings
 * YYYY-MM-DD (las queries de HSM consumen strings, no Date).
 */
function computePeriods(fromIso: string, toIso: string): PeriodStrings {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  const days =
    Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));

  return {
    from: fromIso,
    to: toIso,
    prevFrom: prevFrom.toISOString().slice(0, 10),
    prevTo: prevTo.toISOString().slice(0, 10),
  };
}

function defaultFromIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 29);
  return d.toISOString().slice(0, 10);
}

function defaultToIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ThroughputAndCritical {
  throughputRatio: number;
  criticalInSlaPct: number | null;
}

/**
 * Calcula `throughput_ratio` y `critical_in_sla_pct` con SQL inline.
 * Estas métricas NO existen en otras queries — se computan aquí solo para
 * exponerlas al portal. Si el portal pide más rangos, evaluar mover a
 * `dashboard.ts` con cobertura propia.
 */
async function computeThroughputAndCritical(
  fromIso: string,
  toIso: string,
): Promise<ThroughputAndCritical> {
  const result = await db.execute(sql`
    WITH closed AS (
      SELECT count(*)::int AS c
      FROM hsm.incidents
      WHERE resolved_at IS NOT NULL
        AND status IN ('resuelto', 'cerrado')
        AND resolved_at >= ${fromIso}::date
        AND resolved_at < (${toIso}::date + interval '1 day')
    ),
    opened AS (
      SELECT count(*)::int AS c
      FROM hsm.incidents
      WHERE created_at >= ${fromIso}::date
        AND created_at < (${toIso}::date + interval '1 day')
    ),
    crit AS (
      SELECT
        count(*)::int AS total,
        count(*) FILTER (
          WHERE EXTRACT(EPOCH FROM (resolved_at - created_at)) <= 8 * 3600
        )::int AS in_sla
      FROM hsm.incidents
      WHERE priority = 'critica'
        AND status IN ('resuelto', 'cerrado')
        AND resolved_at IS NOT NULL
        AND resolved_at >= ${fromIso}::date
        AND resolved_at < (${toIso}::date + interval '1 day')
    )
    SELECT
      closed.c AS closed_count,
      opened.c AS opened_count,
      crit.total AS crit_total,
      crit.in_sla AS crit_in_sla
    FROM closed, opened, crit
  `);

  const row = result[0] as
    | {
        closed_count: number | string;
        opened_count: number | string;
        crit_total: number | string;
        crit_in_sla: number | string;
      }
    | undefined;

  if (!row) {
    return { throughputRatio: 1, criticalInSlaPct: null };
  }

  const closed = Number(row.closed_count) || 0;
  const opened = Number(row.opened_count) || 0;
  const critTotal = Number(row.crit_total) || 0;
  const critInSla = Number(row.crit_in_sla) || 0;

  const throughputRatio = opened === 0 ? 1 : Math.round((closed / opened) * 100) / 100;
  const criticalInSlaPct =
    critTotal === 0 ? null : Math.round((critInSla / critTotal) * 1000) / 10;

  return { throughputRatio, criticalInSlaPct };
}

/**
 * Coerciona valores que las queries Drizzle marcan como `number` pero
 * Postgres devuelve como string (e.g. NUMERIC, ROUND(numeric, 1)). Sin
 * esto, los strings cuelan al JSON serializado y el portal falla en el
 * `safeParse` Zod con "Shape inesperado".
 */
function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Combina los 3 arrays de proveedores en `topProviders` ordenado por
 * volumen RMA descendente (top 5).
 */
function buildTopProviders(
  volume: Awaited<ReturnType<typeof getProviderRmaVolume>>,
  success: Awaited<ReturnType<typeof getProviderSuccessRate>>,
  turnaround: Awaited<ReturnType<typeof getProviderRmaTurnaround>>,
) {
  const successById = new Map(success.map((s) => [s.providerId, s]));
  const turnaroundById = new Map(turnaround.map((t) => [t.providerId, t]));

  return volume
    .map((v) => ({
      provider_id: v.providerId,
      provider_name: v.providerName,
      rma_count: toNumberOrNull(v.total) ?? 0,
      success_rate_pct: toNumberOrNull(successById.get(v.providerId)?.rate) ?? 0,
      // `avgDays` viene como string desde Postgres (ROUND devuelve numeric).
      // Sin coerción, el portal falla en el Zod parse → escudo neutral.
      avg_turnaround_days: toNumberOrNull(turnaroundById.get(v.providerId)?.avgDays),
    }))
    .sort((a, b) => b.rma_count - a.rma_count)
    .slice(0, 5);
}

async function buildPayload(periods: PeriodStrings) {
  const { from, to, prevFrom, prevTo } = periods;
  const currentRange = { dateFrom: from, dateTo: to };
  const prevRange = { dateFrom: prevFrom, dateTo: prevTo };

  const [
    statsCurrent,
    slaCurrent,
    agingDist,
    providersVolume,
    providersSuccess,
    providersTurnaround,
    statsPrev,
    slaPrev,
    extra,
    quickCurrent,
    quickPrev,
  ] = await Promise.all([
    getDashboardStats(currentRange),
    getSlaMetrics(currentRange),
    getAgingDistribution(currentRange),
    getProviderRmaVolume(currentRange),
    getProviderSuccessRate(currentRange),
    getProviderRmaTurnaround(currentRange),
    getDashboardStats(prevRange),
    getSlaMetrics(prevRange),
    computeThroughputAndCritical(from, to),
    getQuickConsultationsStats(currentRange),
    getQuickConsultationsStats(prevRange),
  ]);

  const topProviders = buildTopProviders(
    providersVolume,
    providersSuccess,
    providersTurnaround,
  );

  // Map aging buckets (es) → enum (en) según spec del portal.
  const agingDistribution = agingDist
    .map((a) => {
      const bucket = AGING_BUCKET_MAP[a.bucket];
      return bucket ? { bucket, count: a.count } : null;
    })
    .filter((x): x is { bucket: "lt_1d" | "1_3d" | "3_7d" | "gt_7d"; count: number } => x !== null);

  return {
    generated_at: new Date().toISOString(),
    schema_version: "1.1.0",
    filters: { from, to, prev_from: prevFrom, prev_to: prevTo },
    current: {
      open_incidents: toNumberOrNull(statsCurrent.openIncidents) ?? 0,
      active_rmas: toNumberOrNull(statsCurrent.activeRmas) ?? 0,
      sla_compliance_pct: toNumberOrNull(slaCurrent.slaCompliancePercent) ?? 0,
      overdue_count: toNumberOrNull(slaCurrent.overdueCount) ?? 0,
      avg_resolution_hours: toNumberOrNull(slaCurrent.avgResolutionHours),
      reopen_rate_pct: toNumberOrNull(slaCurrent.reopenRate) ?? 0,
      avg_rma_turnaround_days: toNumberOrNull(slaCurrent.avgRmaTurnaroundDays),
      critical_in_sla_pct: toNumberOrNull(extra.criticalInSlaPct),
      throughput_ratio: toNumberOrNull(extra.throughputRatio) ?? 0,
      incidents_by_priority: slaCurrent.incidentsByPriority,
      aging_distribution: agingDistribution,
      top_providers: topProviders,
      // "Carga oculta": consultas rápidas atendidas in-situ. NO entran en
      // el cálculo SLA (filtradas en getSlaMetrics) pero sí cuentan como
      // capacidad resolutiva del depto en su propio bloque.
      quick_consultations: {
        count: toNumberOrNull(quickCurrent.count) ?? 0,
        total_minutes: toNumberOrNull(quickCurrent.totalMinutes) ?? 0,
        avg_minutes: toNumberOrNull(quickCurrent.avgMinutes),
        by_technician: quickCurrent.byTechnician.map((t) => ({
          name: t.name,
          count: toNumberOrNull(t.count) ?? 0,
          total_minutes: toNumberOrNull(t.totalMinutes) ?? 0,
        })),
        conversion_rate_pct: toNumberOrNull(quickCurrent.conversionRatePct) ?? 0,
      },
    },
    previous: {
      sla_compliance_pct: toNumberOrNull(slaPrev.slaCompliancePercent) ?? 0,
      avg_resolution_hours: toNumberOrNull(slaPrev.avgResolutionHours),
      reopen_rate_pct: toNumberOrNull(slaPrev.reopenRate) ?? 0,
      open_incidents_at_close: toNumberOrNull(statsPrev.openIncidents) ?? 0,
      quick_consultations: {
        count: toNumberOrNull(quickPrev.count) ?? 0,
        total_minutes: toNumberOrNull(quickPrev.totalMinutes) ?? 0,
      },
    },
  };
}

export async function GET(req: NextRequest) {
  // 1) Auth — antes que cualquier query.
  const authError = requireMainPortalAuth(req);
  if (authError) return authError;

  // 2) Parse query params con defaults.
  const { searchParams } = req.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam && !ISO_DATE_RE.test(fromParam)) {
    return NextResponse.json(
      { error: "Invalid `from` param", detail: "Expected YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (toParam && !ISO_DATE_RE.test(toParam)) {
    return NextResponse.json(
      { error: "Invalid `to` param", detail: "Expected YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const fromIso = fromParam ?? defaultFromIso();
  const toIso = toParam ?? defaultToIso();

  if (fromIso > toIso) {
    return NextResponse.json(
      { error: "`from` must be ≤ `to`" },
      { status: 400 },
    );
  }

  const periods = computePeriods(fromIso, toIso);

  // 3) Fetch datos (cacheados 60s por rango).
  try {
    const data = await unstable_cache(
      () => buildPayload(periods),
      ["hsm-external-metrics", periods.from, periods.to],
      { revalidate: 60, tags: ["hsm-external-metrics"] },
    )();

    return NextResponse.json(data, {
      headers: { "Cache-Control": "max-age=60, public" },
    });
  } catch (err) {
    console.error("[api/external/metrics] error:", err);
    return NextResponse.json(
      {
        error: "Internal error building payload",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
