import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";

import { requirePublicApiAuth } from "@/lib/external-auth";
import {
  getIncidents,
  getIncidentsAggregates,
  type IncidentAggregatesFilters,
} from "@/server/queries/incidents";
import {
  getSlaMetrics,
  getAgingDistribution,
} from "@/server/queries/dashboard";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_CATEGORY_LABELS,
  HARDWARE_ORIGIN_LABELS,
  type IncidentStatus,
} from "@/lib/constants/incidents";

/**
 * GET /api/external/incidents
 *
 * Endpoint público para herramientas externas (CRM, análisis, etc.) que
 * necesitan acceso DETALLADO a las incidencias HSM (incluyendo PII).
 *
 * Auth con header `X-API-Key` validado contra `process.env.HSM_PUBLIC_API_KEY`
 * con `crypto.timingSafeEqual`. Secret DIFERENTE al de Main Portal para que
 * cada consumidor pueda rotarse de forma aislada.
 *
 * Query params (todos opcionales):
 *   - from, to: YYYY-MM-DD — rango de creación (default: últimos 30 días)
 *   - status: CSV — alias `open` / `closed` o estados específicos
 *   - priority: CSV — baja, media, alta, critica
 *   - category: CSV — escalado, incidencia_directa, mencion, otro, consulta_rapida
 *   - hardware_origin: CSV — qamarero, cliente_reciclado
 *   - assigned_user_id: CSV UUIDs
 *   - search: string — busca en número/título/cliente/marca/modelo/serial/intercom_id
 *   - page: int (default 1)
 *   - page_size: int (default 50, max 200)
 *
 * Response:
 *   { generated_at, schema_version, filters, summary, data[], pagination }
 *
 * Cache: 30s en `unstable_cache` (tag invalidable).
 *
 * Spec completa: docs/connectors/hsm-incidents-endpoint-spec.md
 */

export const runtime = "nodejs"; // crypto.timingSafeEqual requiere Node runtime
export const dynamic = "force-dynamic"; // depende de query params + headers

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Status aliases — expanded by `expandStatus()`. */
const STATUS_ALIASES: Record<string, IncidentStatus[]> = {
  open: ["nuevo", "en_triaje", "en_gestion", "esperando_cliente", "esperando_proveedor"],
  closed: ["resuelto", "cerrado", "cancelado"],
};

const ALL_STATUSES: ReadonlyArray<IncidentStatus> = [
  "nuevo", "en_triaje", "en_gestion", "esperando_cliente", "esperando_proveedor",
  "resuelto", "cerrado", "cancelado",
];

const ALL_PRIORITIES = ["baja", "media", "alta", "critica"] as const;
const ALL_CATEGORIES = ["escalado", "incidencia_directa", "mencion", "otro", "consulta_rapida"] as const;
const ALL_HARDWARE_ORIGINS = ["qamarero", "cliente_reciclado"] as const;

const CLOSED_INCIDENT_STATUSES: ReadonlyArray<IncidentStatus> = ["resuelto", "cerrado", "cancelado"];

/** Aging buckets — español interno → enum del spec. */
const AGING_BUCKET_MAP: Record<string, "lt_1d" | "1_3d" | "3_7d" | "gt_7d"> = {
  "< 1 día": "lt_1d",
  "1-3 días": "1_3d",
  "3-7 días": "3_7d",
  "7+ días": "gt_7d",
};

function defaultFromIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 29);
  return d.toISOString().slice(0, 10);
}

function defaultToIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseCsv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const tokens = value.split(",").map((s) => s.trim()).filter(Boolean);
  return tokens.length > 0 ? tokens : undefined;
}

function expandStatus(value: string | null): IncidentStatus[] | undefined {
  const tokens = parseCsv(value);
  if (!tokens) return undefined;
  const expanded: string[] = [];
  for (const t of tokens) {
    if (t in STATUS_ALIASES) expanded.push(...STATUS_ALIASES[t]);
    else expanded.push(t);
  }
  const validated = expanded.filter((v): v is IncidentStatus =>
    (ALL_STATUSES as readonly string[]).includes(v),
  );
  return validated.length > 0 ? validated : undefined;
}

function filterValid<T extends string>(
  values: string[] | undefined,
  allowed: ReadonlyArray<T>,
): T[] | undefined {
  if (!values) return undefined;
  const valid = values.filter((v): v is T => (allowed as readonly string[]).includes(v));
  return valid.length > 0 ? valid : undefined;
}

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Compute hours between two timestamps. */
function hoursBetween(later: Date | null, earlier: Date | null): number | null {
  if (!later || !earlier) return null;
  const ms = later.getTime() - earlier.getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

interface ParsedFilters {
  from: string;
  to: string;
  status?: IncidentStatus[];
  priority?: string[];
  category?: string[];
  hardwareOrigin?: string[];
  assignedUserId?: string[];
  search?: string;
  page: number;
  pageSize: number;
}

async function buildPayload(parsed: ParsedFilters) {
  const aggregatesFilters: IncidentAggregatesFilters = {
    status: parsed.status,
    priority: parsed.priority,
    category: parsed.category,
    hardwareOrigin: parsed.hardwareOrigin,
    assignedUserId: parsed.assignedUserId,
    search: parsed.search,
    dateRangeFrom: parsed.from,
    dateRangeTo: parsed.to,
  };

  const [paginated, aggregates, sla, aging] = await Promise.all([
    getIncidents({
      page: parsed.page,
      pageSize: parsed.pageSize,
      search: parsed.search,
      sortBy: "createdAt",
      sortOrder: "desc",
      filters: {
        status: parsed.status,
        priority: parsed.priority,
        category: parsed.category,
        hardwareOrigin: parsed.hardwareOrigin,
        assignedUserId: parsed.assignedUserId,
        dateRangeFrom: parsed.from,
        dateRangeTo: parsed.to,
      },
    }),
    getIncidentsAggregates(aggregatesFilters),
    getSlaMetrics({ dateFrom: parsed.from, dateTo: parsed.to }),
    getAgingDistribution({ dateFrom: parsed.from, dateTo: parsed.to }),
  ]);

  // Compute open/closed counts from byStatus aggregation
  let openCount = 0;
  let closedCount = 0;
  for (const row of aggregates.byStatus) {
    if ((CLOSED_INCIDENT_STATUSES as readonly string[]).includes(row.status)) {
      closedCount += row.count;
    } else {
      openCount += row.count;
    }
  }

  const now = new Date();

  return {
    generated_at: now.toISOString(),
    schema_version: "1.0.0",
    filters: {
      from: parsed.from,
      to: parsed.to,
      status: parsed.status ?? null,
      priority: parsed.priority ?? null,
      category: parsed.category ?? null,
      hardware_origin: parsed.hardwareOrigin ?? null,
      assigned_user_id: parsed.assignedUserId ?? null,
      search: parsed.search ?? null,
    },
    summary: {
      total_count: aggregates.totalCount,
      open_count: openCount,
      closed_count: closedCount,
      by_status: aggregates.byStatus.map((r) => ({
        status: r.status,
        label: INCIDENT_STATUS_LABELS[r.status as IncidentStatus] ?? r.status,
        count: r.count,
      })),
      by_priority: aggregates.byPriority.map((r) => ({
        priority: r.priority,
        label: INCIDENT_PRIORITY_LABELS[r.priority as keyof typeof INCIDENT_PRIORITY_LABELS] ?? r.priority,
        count: r.count,
      })),
      by_category: aggregates.byCategory.map((r) => ({
        category: r.category,
        label: INCIDENT_CATEGORY_LABELS[r.category as keyof typeof INCIDENT_CATEGORY_LABELS] ?? r.category,
        count: r.count,
      })),
      by_hardware_origin: aggregates.byHardwareOrigin.map((r) => ({
        hardware_origin: r.hardwareOrigin,
        label: r.hardwareOrigin
          ? HARDWARE_ORIGIN_LABELS[r.hardwareOrigin as keyof typeof HARDWARE_ORIGIN_LABELS] ?? r.hardwareOrigin
          : null,
        count: r.count,
      })),
      sla_compliance_pct: toNumberOrNull(sla.slaCompliancePercent),
      avg_resolution_hours: toNumberOrNull(sla.avgResolutionHours),
      overdue_count: toNumberOrNull(sla.overdueCount) ?? 0,
      aging_distribution: aging
        .map((a) => {
          const bucket = AGING_BUCKET_MAP[a.bucket];
          return bucket ? { bucket, count: a.count } : null;
        })
        .filter((x): x is { bucket: "lt_1d" | "1_3d" | "3_7d" | "gt_7d"; count: number } => x !== null),
    },
    data: paginated.data.map((inc) => ({
      id: inc.id,
      incident_number: inc.incidentNumber,
      status: inc.status,
      status_label: INCIDENT_STATUS_LABELS[inc.status as IncidentStatus] ?? inc.status,
      priority: inc.priority,
      category: inc.category,
      hardware_origin: inc.hardwareOrigin,
      title: inc.title,
      description: inc.description,
      client: {
        id: inc.clientId,
        name: inc.clientName,
        company_name: inc.clientCompanyName,
      },
      assigned_user: {
        id: inc.assignedUserId,
        name: inc.assignedUserName,
      },
      device: {
        type: inc.deviceType,
        brand: inc.deviceBrand,
        model: inc.deviceModel,
        serial_number: inc.deviceSerialNumber,
        value_cents: inc.deviceValueCents,
      },
      contact: {
        name: inc.contactName,
        phone: inc.contactPhone,
      },
      pickup: {
        address: inc.pickupAddress,
        city: inc.pickupCity,
        postal_code: inc.pickupPostalCode,
      },
      intercom: {
        url: inc.intercomUrl,
        escalation_id: inc.intercomEscalationId,
      },
      resolution_type: inc.resolutionType,
      quick_duration_minutes: inc.quickDurationMinutes,
      created_at: inc.createdAt.toISOString(),
      updated_at: inc.updatedAt.toISOString(),
      resolved_at: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
      state_changed_at: inc.stateChangedAt.toISOString(),
      age_hours_in_state: hoursBetween(now, inc.stateChangedAt),
      age_hours_total: hoursBetween(now, inc.createdAt),
      sla_paused_ms: inc.slaPausedMs,
    })),
    pagination: {
      page: paginated.page,
      page_size: paginated.pageSize,
      total_pages: paginated.totalPages,
      total_count: paginated.totalCount,
    },
  };
}

export async function GET(req: NextRequest) {
  // 1) Auth — antes que cualquier query.
  const authError = requirePublicApiAuth(req);
  if (authError) return authError;

  // 2) Parse query params.
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

  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("page_size");
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : 50;

  if (!Number.isFinite(page) || page < 1) {
    return NextResponse.json(
      { error: "Invalid `page` param", detail: "Must be a positive integer" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 200) {
    return NextResponse.json(
      { error: "Invalid `page_size` param", detail: "Must be 1-200" },
      { status: 400 },
    );
  }

  const parsed: ParsedFilters = {
    from: fromIso,
    to: toIso,
    status: expandStatus(searchParams.get("status")),
    priority: filterValid(parseCsv(searchParams.get("priority")), ALL_PRIORITIES),
    category: filterValid(parseCsv(searchParams.get("category")), ALL_CATEGORIES),
    hardwareOrigin: filterValid(parseCsv(searchParams.get("hardware_origin")), ALL_HARDWARE_ORIGINS),
    assignedUserId: parseCsv(searchParams.get("assigned_user_id")),
    search: searchParams.get("search") ?? undefined,
    page,
    pageSize,
  };

  // 3) Build response (cached 30s by full query string).
  const cacheKey = JSON.stringify(parsed);

  try {
    const data = await unstable_cache(
      () => buildPayload(parsed),
      ["hsm-external-incidents", cacheKey],
      { revalidate: 30, tags: ["hsm-external-incidents"] },
    )();

    return NextResponse.json(data, {
      headers: { "Cache-Control": "max-age=30, public" },
    });
  } catch (err) {
    console.error("[api/external/incidents] error:", err);
    return NextResponse.json(
      {
        error: "Internal error building payload",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
