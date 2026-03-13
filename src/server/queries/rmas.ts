import { db } from "@/lib/db";
import { rmas, incidents, providers } from "@/lib/db/schema";
import { eq, or, asc, desc, count, sql, type AnyColumn } from "drizzle-orm";
import type { PaginationParams, PaginatedResult } from "@/types";

export type RmaRow = typeof rmas.$inferSelect & {
  providerName: string | null;
  incidentNumber: string | null;
};

export async function getRmas(
  params: PaginationParams
): Promise<PaginatedResult<RmaRow>> {
  const { page, pageSize, search, sortBy = "createdAt", sortOrder = "desc" } = params;
  const offset = (page - 1) * pageSize;

  const searchCondition = search
    ? or(
        sql`${rmas.rmaNumber} ILIKE ${`%${search}%`}`,
        sql`unaccent(${providers.name}) ILIKE unaccent(${`%${search}%`})`,
        sql`unaccent(${rmas.clientName}) ILIKE unaccent(${`%${search}%`})`,
        sql`unaccent(${rmas.deviceBrand}) ILIKE unaccent(${`%${search}%`})`,
        sql`unaccent(${rmas.deviceModel}) ILIKE unaccent(${`%${search}%`})`
      )
    : undefined;

  const sortColumn = getSortColumn(sortBy);
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: rmas.id,
        rmaNumber: rmas.rmaNumber,
        incidentId: rmas.incidentId,
        providerId: rmas.providerId,
        clientName: rmas.clientName,
        clientExternalId: rmas.clientExternalId,
        clientIntercomUrl: rmas.clientIntercomUrl,
        status: rmas.status,
        deviceType: rmas.deviceType,
        deviceBrand: rmas.deviceBrand,
        deviceModel: rmas.deviceModel,
        deviceSerialNumber: rmas.deviceSerialNumber,
        trackingNumberOutgoing: rmas.trackingNumberOutgoing,
        trackingNumberReturn: rmas.trackingNumberReturn,
        providerRmaNumber: rmas.providerRmaNumber,
        clientLocal: rmas.clientLocal,
        address: rmas.address,
        postalCode: rmas.postalCode,
        phone: rmas.phone,
        notes: rmas.notes,
        createdAt: rmas.createdAt,
        updatedAt: rmas.updatedAt,
        stateChangedAt: rmas.stateChangedAt,
        providerName: providers.name,
        incidentNumber: incidents.incidentNumber,
      })
      .from(rmas)
      .leftJoin(providers, eq(rmas.providerId, providers.id))
      .leftJoin(incidents, eq(rmas.incidentId, incidents.id))
      .where(searchCondition)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(rmas)
      .leftJoin(providers, eq(rmas.providerId, providers.id))
      .where(searchCondition),
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

export async function getRmaById(id: string): Promise<RmaRow | null> {
  const [rma] = await db
    .select({
      id: rmas.id,
      rmaNumber: rmas.rmaNumber,
      incidentId: rmas.incidentId,
      providerId: rmas.providerId,
      clientName: rmas.clientName,
      clientExternalId: rmas.clientExternalId,
      clientIntercomUrl: rmas.clientIntercomUrl,
      status: rmas.status,
      deviceType: rmas.deviceType,
      deviceBrand: rmas.deviceBrand,
      deviceModel: rmas.deviceModel,
      deviceSerialNumber: rmas.deviceSerialNumber,
      trackingNumberOutgoing: rmas.trackingNumberOutgoing,
      trackingNumberReturn: rmas.trackingNumberReturn,
      providerRmaNumber: rmas.providerRmaNumber,
      clientLocal: rmas.clientLocal,
      address: rmas.address,
      postalCode: rmas.postalCode,
      phone: rmas.phone,
      notes: rmas.notes,
      createdAt: rmas.createdAt,
      updatedAt: rmas.updatedAt,
      stateChangedAt: rmas.stateChangedAt,
      providerName: providers.name,
      incidentNumber: incidents.incidentNumber,
    })
    .from(rmas)
    .leftJoin(providers, eq(rmas.providerId, providers.id))
    .leftJoin(incidents, eq(rmas.incidentId, incidents.id))
    .where(eq(rmas.id, id))
    .limit(1);

  return rma ?? null;
}

function getSortColumn(sortBy: string): AnyColumn {
  const columns: Record<string, AnyColumn> = {
    rmaNumber: rmas.rmaNumber,
    status: rmas.status,
    createdAt: rmas.createdAt,
    stateChangedAt: rmas.stateChangedAt,
  };
  return columns[sortBy] ?? rmas.createdAt;
}
