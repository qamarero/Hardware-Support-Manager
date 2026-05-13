import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";

import { requirePublicApiAuth } from "@/lib/external-auth";
import {
  getRmas,
  getRmasAggregates,
  type RmaAggregatesFilters,
} from "@/server/queries/rmas";
import {
  RMA_STATUS_LABELS,
  type RmaStatus,
} from "@/lib/constants/rmas";

/**
 * GET /api/external/rmas
 *
 * Endpoint público para herramientas externas que necesitan acceso DETALLADO
 * a los RMAs HSM (incluyendo PII de cliente/contacto).
 *
 * Auth con header `X-API-Key` validado contra `process.env.HSM_PUBLIC_API_KEY`
 * (mismo secret que `/api/external/incidents`).
 *
 * Query params (todos opcionales):
 *   - from, to: YYYY-MM-DD — rango de creación (default: últimos 30 días)
 *   - status: CSV — alias `open` / `closed` o estados específicos
 *   - provider_id: CSV UUIDs
 *   - search: string — busca en número RMA / proveedor / cliente / marca / modelo / serial / nº incidencia
 *   - page: int (default 1)
 *   - page_size: int (default 50, max 200)
 *
 * Spec: docs/connectors/hsm-incidents-endpoint-spec.md
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Status aliases. */
const STATUS_ALIASES: Record<string, RmaStatus[]> = {
  // Active = anything not cerrado/cancelado
  open: ["borrador", "solicitado", "aprobado", "enviado_proveedor", "en_proveedor", "devuelto", "recibido_oficina"],
  closed: ["cerrado", "cancelado"],
};

const ALL_STATUSES: ReadonlyArray<RmaStatus> = [
  "borrador", "solicitado", "aprobado", "enviado_proveedor",
  "en_proveedor", "devuelto", "recibido_oficina",
  "cerrado", "cancelado",
];

const CLOSED_RMA_STATUSES: ReadonlyArray<RmaStatus> = ["cerrado", "cancelado"];

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

function expandStatus(value: string | null): RmaStatus[] | undefined {
  const tokens = parseCsv(value);
  if (!tokens) return undefined;
  const expanded: string[] = [];
  for (const t of tokens) {
    if (t in STATUS_ALIASES) expanded.push(...STATUS_ALIASES[t]);
    else expanded.push(t);
  }
  const validated = expanded.filter((v): v is RmaStatus =>
    (ALL_STATUSES as readonly string[]).includes(v),
  );
  return validated.length > 0 ? validated : undefined;
}

function hoursBetween(later: Date | null, earlier: Date | null): number | null {
  if (!later || !earlier) return null;
  const ms = later.getTime() - earlier.getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

interface ParsedFilters {
  from: string;
  to: string;
  status?: RmaStatus[];
  providerId?: string[];
  search?: string;
  page: number;
  pageSize: number;
}

async function buildPayload(parsed: ParsedFilters) {
  const aggregatesFilters: RmaAggregatesFilters = {
    status: parsed.status,
    providerId: parsed.providerId,
    search: parsed.search,
    dateRangeFrom: parsed.from,
    dateRangeTo: parsed.to,
  };

  const [paginated, aggregates] = await Promise.all([
    getRmas({
      page: parsed.page,
      pageSize: parsed.pageSize,
      search: parsed.search,
      sortBy: "createdAt",
      sortOrder: "desc",
      filters: {
        status: parsed.status,
        providerId: parsed.providerId,
        dateRangeFrom: parsed.from,
        dateRangeTo: parsed.to,
      },
    }),
    getRmasAggregates(aggregatesFilters),
  ]);

  let openCount = 0;
  let closedCount = 0;
  for (const row of aggregates.byStatus) {
    if ((CLOSED_RMA_STATUSES as readonly string[]).includes(row.status)) {
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
      provider_id: parsed.providerId ?? null,
      search: parsed.search ?? null,
    },
    summary: {
      total_count: aggregates.totalCount,
      open_count: openCount,
      closed_count: closedCount,
      by_status: aggregates.byStatus.map((r) => ({
        status: r.status,
        label: RMA_STATUS_LABELS[r.status as RmaStatus] ?? r.status,
        count: r.count,
      })),
      by_provider: aggregates.byProvider
        .map((r) => ({
          provider_id: r.providerId,
          provider_name: r.providerName,
          count: r.count,
        }))
        .sort((a, b) => b.count - a.count),
    },
    data: paginated.data.map((rma) => ({
      id: rma.id,
      rma_number: rma.rmaNumber,
      status: rma.status,
      status_label: RMA_STATUS_LABELS[rma.status as RmaStatus] ?? rma.status,
      incident: {
        id: rma.incidentId,
        number: rma.incidentNumber,
      },
      provider: {
        id: rma.providerId,
        name: rma.providerName,
        rma_number: rma.providerRmaNumber,
      },
      client: {
        id: rma.clientId,
        name: rma.clientName,
        company_name: rma.clientCompanyName,
        external_id: rma.clientExternalId,
        intercom_url: rma.clientIntercomUrl,
      },
      device: {
        type: rma.deviceType,
        brand: rma.deviceBrand,
        model: rma.deviceModel,
        serial_number: rma.deviceSerialNumber,
        value_cents: rma.deviceValueCents,
      },
      contact: {
        name: rma.contactName,
        phone: rma.contactPhone,
      },
      pickup: {
        address: rma.pickupAddress,
        city: rma.pickupCity,
        postal_code: rma.pickupPostalCode,
      },
      tracking: {
        outgoing: rma.trackingNumberOutgoing,
        return: rma.trackingNumberReturn,
      },
      costs: {
        repair_cents: rma.repairCostCents,
        shipping_cents: rma.shippingCostCents,
        replacement_cents: rma.replacementCostCents,
      },
      notes: rma.notes,
      created_at: rma.createdAt.toISOString(),
      updated_at: rma.updatedAt.toISOString(),
      state_changed_at: rma.stateChangedAt.toISOString(),
      age_hours_in_state: hoursBetween(now, rma.stateChangedAt),
      age_hours_total: hoursBetween(now, rma.createdAt),
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
  // 1) Auth
  const authError = requirePublicApiAuth(req);
  if (authError) return authError;

  // 2) Parse params
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
    providerId: parseCsv(searchParams.get("provider_id")),
    search: searchParams.get("search") ?? undefined,
    page,
    pageSize,
  };

  const cacheKey = JSON.stringify(parsed);

  try {
    const data = await unstable_cache(
      () => buildPayload(parsed),
      ["hsm-external-rmas", cacheKey],
      { revalidate: 30, tags: ["hsm-external-rmas"] },
    )();

    return NextResponse.json(data, {
      headers: { "Cache-Control": "max-age=30, public" },
    });
  } catch (err) {
    console.error("[api/external/rmas] error:", err);
    return NextResponse.json(
      {
        error: "Internal error building payload",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
