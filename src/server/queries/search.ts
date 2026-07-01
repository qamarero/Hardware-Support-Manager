import { db } from "@/lib/db";
import {
  incidents,
  rmas,
  clients,
  providers,
} from "@/lib/db/schema";
import { eq, or, desc, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  accentInsensitiveLike,
  accentNormalizedConcat,
  fuzzyWordMatch,
  relevanceScore,
} from "@/lib/utils/sql-search";

/**
 * Cross-entity global search used by the sidebar search bar.
 *
 * Each call accepts an array of pre-normalized tokens (lowercased, accent
 * stripped). Tokens are combined with OR so a query like "cafe cantina"
 * returns rows matching either — per user spec.
 *
 * Two matchers per token:
 *   1. `accentInsensitiveLike` — case + accent insensitive substring (exact).
 *   2. `fuzzyWordMatch` — pg_trgm trigram similarity, for typos (e.g.
 *      "txoco" → "Txoko"). Only applied to tokens ≥ 4 chars to avoid noise.
 *
 * Results are ordered by trigram relevance (best match first), then recency,
 * so the closest match surfaces even with the 5-row limit.
 */

// Solo se aplica el emparejamiento aproximado a tokens de 4+ caracteres:
// en tokens muy cortos el trigrama produce ruido.
const FUZZY_MIN_LEN = 4;

export interface IncidentSearchResult {
  id: string;
  incidentNumber: string;
  title: string;
  clientCompanyName: string | null;
  clientName: string | null;
  status: string;
  deviceBrand: string | null;
  deviceModel: string | null;
}

export interface RmaSearchResult {
  id: string;
  rmaNumber: string;
  clientCompanyName: string | null;
  clientName: string | null;
  status: string;
  deviceBrand: string | null;
  deviceModel: string | null;
  providerName: string | null;
  incidentNumber: string | null;
}

/** Text columns searched for incidents (joined with clients). */
const incidentTextColumns: (AnyColumn | SQL)[] = [
  incidents.incidentNumber,
  incidents.title,
  incidents.description,
  incidents.clientName,
  incidents.deviceType,
  incidents.deviceBrand,
  incidents.deviceModel,
  incidents.deviceSerialNumber,
  incidents.contactName,
  incidents.pickupCity,
  incidents.pickupAddress,
  incidents.intercomEscalationId,
  clients.name,
  clients.city,
];

/** Text columns searched for RMAs (joined with providers, incidents, clients). */
function rmaTextColumns(
  linkedIncident: ReturnType<typeof alias>,
): (AnyColumn | SQL)[] {
  return [
    rmas.rmaNumber,
    rmas.clientName,
    rmas.deviceType,
    rmas.deviceBrand,
    rmas.deviceModel,
    rmas.deviceSerialNumber,
    rmas.providerRmaNumber,
    rmas.trackingNumberOutgoing,
    rmas.trackingNumberReturn,
    rmas.contactName,
    rmas.pickupCity,
    rmas.pickupAddress,
    rmas.notes,
    providers.name,
    clients.name,
    clients.city,
    linkedIncident.incidentNumber,
  ];
}

/** Per-token WHERE for incidents: exact substring on each column + fuzzy fallback. */
function buildIncidentTokenWhere(token: string) {
  return or(
    ...incidentTextColumns.map((c) => accentInsensitiveLike(c, token)),
    token.length >= FUZZY_MIN_LEN
      ? fuzzyWordMatch(accentNormalizedConcat(incidentTextColumns), token)
      : undefined,
  );
}

/** Per-token WHERE for RMAs: exact substring on each column + fuzzy fallback. */
function buildRmaTokenWhere(
  token: string,
  linkedIncident: ReturnType<typeof alias>,
) {
  const cols = rmaTextColumns(linkedIncident);
  return or(
    ...cols.map((c) => accentInsensitiveLike(c, token)),
    token.length >= FUZZY_MIN_LEN
      ? fuzzyWordMatch(accentNormalizedConcat(cols), token)
      : undefined,
  );
}

export async function searchIncidentsByTokens(
  tokens: string[],
  limit = 5,
): Promise<IncidentSearchResult[]> {
  if (tokens.length === 0) return [];

  // OR between tokens — user wants UNION of matches.
  const whereCondition = or(...tokens.map((t) => buildIncidentTokenWhere(t)));
  const score = relevanceScore(accentNormalizedConcat(incidentTextColumns), tokens);

  try {
    const rows = await db
      .select({
        id: incidents.id,
        incidentNumber: incidents.incidentNumber,
        title: incidents.title,
        clientCompanyName: clients.name,
        clientName: incidents.clientName,
        status: incidents.status,
        deviceBrand: incidents.deviceBrand,
        deviceModel: incidents.deviceModel,
      })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .where(whereCondition)
      .orderBy(sql`${score} desc`, desc(incidents.createdAt))
      .limit(limit);
    return rows as IncidentSearchResult[];
  } catch (err) {
    console.error("[search] searchIncidentsByTokens error:", err);
    return [];
  }
}

export async function searchRmasByTokens(
  tokens: string[],
  limit = 5,
): Promise<RmaSearchResult[]> {
  if (tokens.length === 0) return [];

  // Alias incidents so we can join it to RMAs without column-name clash.
  const linkedIncident = alias(incidents, "linked_incident");

  const whereCondition = or(
    ...tokens.map((t) => buildRmaTokenWhere(t, linkedIncident)),
  );
  const score = relevanceScore(
    accentNormalizedConcat(rmaTextColumns(linkedIncident)),
    tokens,
  );

  try {
    const rows = await db
      .select({
        id: rmas.id,
        rmaNumber: rmas.rmaNumber,
        clientCompanyName: clients.name,
        clientName: rmas.clientName,
        status: rmas.status,
        deviceBrand: rmas.deviceBrand,
        deviceModel: rmas.deviceModel,
        providerName: providers.name,
        incidentNumber: linkedIncident.incidentNumber,
      })
      .from(rmas)
      .leftJoin(providers, eq(rmas.providerId, providers.id))
      .leftJoin(linkedIncident, eq(rmas.incidentId, linkedIncident.id))
      .leftJoin(clients, eq(rmas.clientId, clients.id))
      .where(whereCondition)
      .orderBy(sql`${score} desc`, desc(rmas.createdAt))
      .limit(limit);
    return rows as RmaSearchResult[];
  } catch (err) {
    console.error("[search] searchRmasByTokens error:", err);
    return [];
  }
}
