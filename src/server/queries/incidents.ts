import { db } from "@/lib/db";
import { incidents, users, clients, clientLocations, rmas } from "@/lib/db/schema";
import { eq, ne, or, and, not, asc, desc, count, sql, gte, lte, inArray, type AnyColumn } from "drizzle-orm";
import { CLOSED_INCIDENT_STATUSES, CLOSED_RMA_STATUSES } from "@/lib/constants/statuses";
import type { PaginationParams, PaginatedResult } from "@/types";

export type IncidentRow = typeof incidents.$inferSelect & {
  assignedUserName: string | null;
  clientCompanyName: string | null;
  clientLocationName?: string | null;
};

export async function getIncidents(
  params: PaginationParams
): Promise<PaginatedResult<IncidentRow>> {
  const { page, pageSize, search, sortBy = "createdAt", sortOrder = "desc", filters } = params;
  const offset = (page - 1) * pageSize;

  const searchCondition = search
    ? or(
        sql`${incidents.incidentNumber} ILIKE ${`%${search}%`}`,
        sql`${incidents.title} ILIKE ${`%${search}%`}`,
        sql`${incidents.clientName} ILIKE ${`%${search}%`}`,
        sql`${clients.name} ILIKE ${`%${search}%`}`,
        sql`${incidents.deviceSerialNumber} ILIKE ${`%${search}%`}`,
        sql`${incidents.intercomEscalationId} ILIKE ${`%${search}%`}`
      )
    : undefined;

  // Build filter conditions
  const filterConditions = [];
  if (searchCondition) filterConditions.push(searchCondition);
  if (filters?.status && Array.isArray(filters.status) && filters.status.length > 0) {
    filterConditions.push(inArray(incidents.status, filters.status as typeof incidents.status.enumValues));
  }
  if (filters?.priority && Array.isArray(filters.priority) && filters.priority.length > 0) {
    filterConditions.push(inArray(incidents.priority, filters.priority as typeof incidents.priority.enumValues));
  }
  if (filters?.category && Array.isArray(filters.category) && filters.category.length > 0) {
    filterConditions.push(inArray(incidents.category, filters.category as typeof incidents.category.enumValues));
  }
  if (filters?.hardwareOrigin && Array.isArray(filters.hardwareOrigin) && filters.hardwareOrigin.length > 0) {
    filterConditions.push(inArray(incidents.hardwareOrigin, filters.hardwareOrigin as typeof incidents.hardwareOrigin.enumValues));
  }
  if (filters?.assignedUserId && Array.isArray(filters.assignedUserId) && filters.assignedUserId.length > 0) {
    filterConditions.push(inArray(incidents.assignedUserId, filters.assignedUserId));
  }
  if (filters?.dateRangeFrom && typeof filters.dateRangeFrom === "string") {
    filterConditions.push(gte(incidents.createdAt, new Date(filters.dateRangeFrom + "T00:00:00")));
  }
  if (filters?.dateRangeTo && typeof filters.dateRangeTo === "string") {
    filterConditions.push(lte(incidents.createdAt, new Date(filters.dateRangeTo + "T23:59:59")));
  }
  const whereCondition = filterConditions.length > 0 ? and(...filterConditions) : undefined;

  const sortColumn = getSortColumn(sortBy);
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: incidents.id,
        incidentNumber: incidents.incidentNumber,
        clientId: incidents.clientId,
        clientName: incidents.clientName,
        assignedUserId: incidents.assignedUserId,
        category: incidents.category,
        hardwareOrigin: incidents.hardwareOrigin,
        priority: incidents.priority,
        status: incidents.status,
        title: incidents.title,
        description: incidents.description,
        deviceBrand: incidents.deviceBrand,
        deviceModel: incidents.deviceModel,
        deviceType: incidents.deviceType,
        deviceSerialNumber: incidents.deviceSerialNumber,
        intercomUrl: incidents.intercomUrl,
        intercomEscalationId: incidents.intercomEscalationId,
        contactName: incidents.contactName,
        contactPhone: incidents.contactPhone,
        pickupAddress: incidents.pickupAddress,
        pickupPostalCode: incidents.pickupPostalCode,
        pickupCity: incidents.pickupCity,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
        resolvedAt: incidents.resolvedAt,
        stateChangedAt: incidents.stateChangedAt,
        slaPausedMs: incidents.slaPausedMs,
        slaHours: incidents.slaHours,
        clientLocationId: incidents.clientLocationId,
        diagnosis: incidents.diagnosis,
        resolution: incidents.resolution,
        resolutionType: incidents.resolutionType,
        articleId: incidents.articleId,
        deviceValueCents: incidents.deviceValueCents,
        quickDurationMinutes: incidents.quickDurationMinutes,
        assignedUserName: users.name,
        clientCompanyName: clients.name,
      })
      .from(incidents)
      .leftJoin(users, eq(incidents.assignedUserId, users.id))
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .where(whereCondition)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .where(whereCondition),
  ]);

  const totalCount = totalResult[0].count;

  return {
    data,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

export async function getIncidentById(id: string): Promise<IncidentRow | null> {
  const [incident] = await db
    .select({
      id: incidents.id,
      incidentNumber: incidents.incidentNumber,
      clientId: incidents.clientId,
      clientName: incidents.clientName,
      assignedUserId: incidents.assignedUserId,
      category: incidents.category,
      hardwareOrigin: incidents.hardwareOrigin,
      priority: incidents.priority,
      status: incidents.status,
      title: incidents.title,
      description: incidents.description,
      deviceType: incidents.deviceType,
      deviceBrand: incidents.deviceBrand,
      deviceModel: incidents.deviceModel,
      deviceSerialNumber: incidents.deviceSerialNumber,
      intercomUrl: incidents.intercomUrl,
      intercomEscalationId: incidents.intercomEscalationId,
      contactName: incidents.contactName,
      contactPhone: incidents.contactPhone,
      pickupAddress: incidents.pickupAddress,
      pickupPostalCode: incidents.pickupPostalCode,
      pickupCity: incidents.pickupCity,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
      resolvedAt: incidents.resolvedAt,
      stateChangedAt: incidents.stateChangedAt,
      slaPausedMs: incidents.slaPausedMs,
      slaHours: incidents.slaHours,
      clientLocationId: incidents.clientLocationId,
      diagnosis: incidents.diagnosis,
      resolution: incidents.resolution,
      resolutionType: incidents.resolutionType,
      articleId: incidents.articleId,
      deviceValueCents: incidents.deviceValueCents,
      quickDurationMinutes: incidents.quickDurationMinutes,
      assignedUserName: users.name,
      clientCompanyName: clients.name,
      clientLocationName: clientLocations.name,
    })
    .from(incidents)
    .leftJoin(users, eq(incidents.assignedUserId, users.id))
    .leftJoin(clients, eq(incidents.clientId, clients.id))
    .leftJoin(clientLocations, eq(incidents.clientLocationId, clientLocations.id))
    .where(eq(incidents.id, id))
    .limit(1);

  return incident ?? null;
}

export interface LinkedRma {
  id: string;
  rmaNumber: string;
  status: string;
}

export async function getLinkedRmas(incidentId: string): Promise<LinkedRma[]> {
  return db
    .select({
      id: rmas.id,
      rmaNumber: rmas.rmaNumber,
      status: rmas.status,
    })
    .from(rmas)
    .where(eq(rmas.incidentId, incidentId));
}

function getSortColumn(sortBy: string): AnyColumn {
  const columns: Record<string, AnyColumn> = {
    incidentNumber: incidents.incidentNumber,
    title: incidents.title,
    status: incidents.status,
    priority: incidents.priority,
    createdAt: incidents.createdAt,
    stateChangedAt: incidents.stateChangedAt,
    resolvedAt: incidents.resolvedAt,
  };
  return columns[sortBy] ?? incidents.createdAt;
}

// ─── Aggregates (for external API summary) ──────────────────────────────────
//
// Returns 4 GROUP BY breakdowns + totals for a filter set. Used by
// /api/external/incidents to populate the "summary" block alongside the
// paginated list. Runs all 4 queries in parallel.

export interface IncidentAggregatesFilters {
  status?: readonly string[];
  priority?: readonly string[];
  category?: readonly string[];
  hardwareOrigin?: readonly string[];
  assignedUserId?: readonly string[];
  dateRangeFrom?: string;
  dateRangeTo?: string;
  search?: string;
}

export interface IncidentAggregates {
  totalCount: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byHardwareOrigin: { hardwareOrigin: string | null; count: number }[];
}

function buildIncidentFilterConditions(filters: IncidentAggregatesFilters) {
  const conds = [];

  if (filters.search) {
    conds.push(
      or(
        sql`${incidents.incidentNumber} ILIKE ${`%${filters.search}%`}`,
        sql`${incidents.title} ILIKE ${`%${filters.search}%`}`,
        sql`${incidents.clientName} ILIKE ${`%${filters.search}%`}`,
        sql`${clients.name} ILIKE ${`%${filters.search}%`}`,
        sql`${incidents.deviceSerialNumber} ILIKE ${`%${filters.search}%`}`,
        sql`${incidents.intercomEscalationId} ILIKE ${`%${filters.search}%`}`
      )
    );
  }
  if (filters.status && filters.status.length > 0) {
    conds.push(inArray(incidents.status, filters.status as typeof incidents.status.enumValues));
  }
  if (filters.priority && filters.priority.length > 0) {
    conds.push(inArray(incidents.priority, filters.priority as typeof incidents.priority.enumValues));
  }
  if (filters.category && filters.category.length > 0) {
    conds.push(inArray(incidents.category, filters.category as typeof incidents.category.enumValues));
  }
  if (filters.hardwareOrigin && filters.hardwareOrigin.length > 0) {
    conds.push(inArray(incidents.hardwareOrigin, filters.hardwareOrigin as typeof incidents.hardwareOrigin.enumValues));
  }
  if (filters.assignedUserId && filters.assignedUserId.length > 0) {
    conds.push(inArray(incidents.assignedUserId, filters.assignedUserId as string[]));
  }
  if (filters.dateRangeFrom) {
    conds.push(gte(incidents.createdAt, new Date(filters.dateRangeFrom + "T00:00:00Z")));
  }
  if (filters.dateRangeTo) {
    conds.push(lte(incidents.createdAt, new Date(filters.dateRangeTo + "T23:59:59Z")));
  }
  return conds.length > 0 ? and(...conds) : undefined;
}

export async function getIncidentsAggregates(
  filters: IncidentAggregatesFilters
): Promise<IncidentAggregates> {
  const whereCond = buildIncidentFilterConditions(filters);

  // Only join clients when search references clients.name. We always include
  // the leftJoin for simplicity — Postgres optimizes the join away when not
  // referenced in WHERE/SELECT.
  const baseFrom = (qb: typeof db.$with extends never ? never : never) => qb;
  void baseFrom; // silence unused

  const [totalRes, byStatusRes, byPriorityRes, byCategoryRes, byOriginRes] = await Promise.all([
    db
      .select({ count: count() })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .where(whereCond),
    db
      .select({ status: incidents.status, count: count() })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .where(whereCond)
      .groupBy(incidents.status),
    db
      .select({ priority: incidents.priority, count: count() })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .where(whereCond)
      .groupBy(incidents.priority),
    db
      .select({ category: incidents.category, count: count() })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .where(whereCond)
      .groupBy(incidents.category),
    db
      .select({ hardwareOrigin: incidents.hardwareOrigin, count: count() })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .where(whereCond)
      .groupBy(incidents.hardwareOrigin),
  ]);

  return {
    totalCount: totalRes[0]?.count ?? 0,
    byStatus: byStatusRes.map((r) => ({ status: r.status, count: r.count })),
    byPriority: byPriorityRes.map((r) => ({ priority: r.priority, count: r.count })),
    byCategory: byCategoryRes.map((r) => ({ category: r.category, count: r.count })),
    byHardwareOrigin: byOriginRes.map((r) => ({ hardwareOrigin: r.hardwareOrigin, count: r.count })),
  };
}

// ─── Contexto del cliente (historial para la ficha) ──────────────────────────

export interface ClientContextResult {
  totalIncidents: number;
  openIncidents: number;
  activeRmas: number;
  recentIncidents: {
    id: string;
    incidentNumber: string;
    title: string;
    status: string;
    createdAt: Date;
  }[];
}

/**
 * Historial operativo de un cliente: nº total de incidencias, abiertas,
 * RMAs activos y las últimas incidencias. Para mostrar en la ficha y dar
 * contexto/recurrencia ("este cliente ya tuvo N incidencias").
 */
export async function getClientContext(
  clientId: string,
  excludeIncidentId?: string
): Promise<ClientContextResult> {
  const closedInc = [...CLOSED_INCIDENT_STATUSES] as (typeof incidents.status.enumValues)[number][];
  const closedRma = [...CLOSED_RMA_STATUSES] as (typeof rmas.status.enumValues)[number][];

  const recentWhere = excludeIncidentId
    ? and(eq(incidents.clientId, clientId), ne(incidents.id, excludeIncidentId))
    : eq(incidents.clientId, clientId);

  const [totalRow, openRow, rmaRow, recent] = await Promise.all([
    db.select({ c: count() }).from(incidents).where(eq(incidents.clientId, clientId)),
    db
      .select({ c: count() })
      .from(incidents)
      .where(and(eq(incidents.clientId, clientId), not(inArray(incidents.status, closedInc)))),
    db
      .select({ c: count() })
      .from(rmas)
      .where(and(eq(rmas.clientId, clientId), not(inArray(rmas.status, closedRma)))),
    db
      .select({
        id: incidents.id,
        incidentNumber: incidents.incidentNumber,
        title: incidents.title,
        status: incidents.status,
        createdAt: incidents.createdAt,
      })
      .from(incidents)
      .where(recentWhere)
      .orderBy(desc(incidents.createdAt))
      .limit(6),
  ]);

  return {
    totalIncidents: totalRow[0]?.c ?? 0,
    openIncidents: openRow[0]?.c ?? 0,
    activeRmas: rmaRow[0]?.c ?? 0,
    recentIncidents: recent,
  };
}
