import { db } from "@/lib/db";
import { incidents, clients, users } from "@/lib/db/schema";
import { eq, or, ilike, asc, desc, count, type AnyColumn } from "drizzle-orm";
import type { PaginationParams, PaginatedResult } from "@/types";

export type IncidentRow = typeof incidents.$inferSelect & {
  clientName: string | null;
  assignedUserName: string | null;
};

export async function getIncidents(
  params: PaginationParams
): Promise<PaginatedResult<IncidentRow>> {
  const { page, pageSize, search, sortBy = "createdAt", sortOrder = "desc" } = params;
  const offset = (page - 1) * pageSize;

  const searchCondition = search
    ? or(
        ilike(incidents.incidentNumber, `%${search}%`),
        ilike(incidents.title, `%${search}%`),
        ilike(clients.name, `%${search}%`)
      )
    : undefined;

  const sortColumn = getSortColumn(sortBy);
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: incidents.id,
        incidentNumber: incidents.incidentNumber,
        clientId: incidents.clientId,
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
        clientName: clients.name,
        assignedUserName: users.name,
      })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
      .leftJoin(users, eq(incidents.assignedUserId, users.id))
      .where(searchCondition)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(incidents)
      .leftJoin(clients, eq(incidents.clientId, clients.id))
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
      clientId: incidents.clientId,
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
      clientName: clients.name,
      assignedUserName: users.name,
    })
    .from(incidents)
    .leftJoin(clients, eq(incidents.clientId, clients.id))
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
