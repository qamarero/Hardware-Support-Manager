import { db } from "@/lib/db";
import { rmas, incidents, providers, clients } from "@/lib/db/schema";
import { eq, or, ilike, asc, desc, count, type AnyColumn } from "drizzle-orm";
import type { PaginationParams, PaginatedResult } from "@/types";

export type RmaRow = typeof rmas.$inferSelect & {
  providerName: string | null;
  incidentNumber: string | null;
  clientName: string | null;
};

export async function getRmas(
  params: PaginationParams
): Promise<PaginatedResult<RmaRow>> {
  const { page, pageSize, search, sortBy = "createdAt", sortOrder = "desc" } = params;
  const offset = (page - 1) * pageSize;

  const searchCondition = search
    ? or(
        ilike(rmas.rmaNumber, `%${search}%`),
        ilike(providers.name, `%${search}%`),
        ilike(clients.name, `%${search}%`),
        ilike(rmas.deviceBrand, `%${search}%`),
        ilike(rmas.deviceModel, `%${search}%`)
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
        clientId: rmas.clientId,
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
        clientName: clients.name,
      })
      .from(rmas)
      .leftJoin(providers, eq(rmas.providerId, providers.id))
      .leftJoin(incidents, eq(rmas.incidentId, incidents.id))
      .leftJoin(clients, eq(rmas.clientId, clients.id))
      .where(searchCondition)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(rmas)
      .leftJoin(providers, eq(rmas.providerId, providers.id))
      .leftJoin(clients, eq(rmas.clientId, clients.id))
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
      clientId: rmas.clientId,
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
      clientName: clients.name,
    })
    .from(rmas)
    .leftJoin(providers, eq(rmas.providerId, providers.id))
    .leftJoin(incidents, eq(rmas.incidentId, incidents.id))
    .leftJoin(clients, eq(rmas.clientId, clients.id))
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
