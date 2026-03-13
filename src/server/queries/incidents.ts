import { db } from "@/lib/db";
import { incidents, users } from "@/lib/db/schema";
import { eq, or, asc, desc, count, sql, type AnyColumn } from "drizzle-orm";
import type { PaginationParams, PaginatedResult } from "@/types";

export type IncidentRow = typeof incidents.$inferSelect & {
  assignedUserName: string | null;
};

export async function getIncidents(
  params: PaginationParams
): Promise<PaginatedResult<IncidentRow>> {
  const { page, pageSize, search, sortBy = "createdAt", sortOrder = "desc" } = params;
  const offset = (page - 1) * pageSize;

  const searchCondition = search
    ? or(
        sql`${incidents.incidentNumber} ILIKE ${`%${search}%`}`,
        sql`unaccent(${incidents.title}) ILIKE unaccent(${`%${search}%`})`,
        sql`unaccent(${incidents.clientName}) ILIKE unaccent(${`%${search}%`})`
      )
    : undefined;

  const sortColumn = getSortColumn(sortBy);
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: incidents.id,
        incidentNumber: incidents.incidentNumber,
        clientName: incidents.clientName,
        assignedUserId: incidents.assignedUserId,
        category: incidents.category,
        priority: incidents.priority,
        status: incidents.status,
        title: incidents.title,
        description: incidents.description,
        deviceBrand: incidents.deviceBrand,
        deviceModel: incidents.deviceModel,
        deviceType: incidents.deviceType,
        deviceSerialNumber: incidents.deviceSerialNumber,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
        resolvedAt: incidents.resolvedAt,
        stateChangedAt: incidents.stateChangedAt,
        assignedUserName: users.name,
      })
      .from(incidents)
      .leftJoin(users, eq(incidents.assignedUserId, users.id))
      .where(searchCondition)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(incidents)
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

export async function getIncidentById(id: string): Promise<IncidentRow | null> {
  const [incident] = await db
    .select({
      id: incidents.id,
      incidentNumber: incidents.incidentNumber,
      clientName: incidents.clientName,
      assignedUserId: incidents.assignedUserId,
      category: incidents.category,
      priority: incidents.priority,
      status: incidents.status,
      title: incidents.title,
      description: incidents.description,
      deviceType: incidents.deviceType,
      deviceBrand: incidents.deviceBrand,
      deviceModel: incidents.deviceModel,
      deviceSerialNumber: incidents.deviceSerialNumber,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
      resolvedAt: incidents.resolvedAt,
      stateChangedAt: incidents.stateChangedAt,
      assignedUserName: users.name,
    })
    .from(incidents)
    .leftJoin(users, eq(incidents.assignedUserId, users.id))
    .where(eq(incidents.id, id))
    .limit(1);

  return incident ?? null;
}

function getSortColumn(sortBy: string): AnyColumn {
  const columns: Record<string, AnyColumn> = {
    incidentNumber: incidents.incidentNumber,
    title: incidents.title,
    status: incidents.status,
    priority: incidents.priority,
    createdAt: incidents.createdAt,
    stateChangedAt: incidents.stateChangedAt,
  };
  return columns[sortBy] ?? incidents.createdAt;
}
