import { db } from "@/lib/db";
import { supportSubmissions, incidents, clients } from "@/lib/db/schema";
import { eq, desc, count, and, ilike, sql, isNull } from "drizzle-orm";
import type { SupportSubmissionStatus } from "@/lib/constants/support-submissions";
import type { PaginationParams } from "@/types";

export type SupportSubmissionRow = typeof supportSubmissions.$inferSelect & {
  convertedIncidentNumber: string | null;
  matchedClientName: string | null;
};

export async function getSupportSubmissions(
  params: PaginationParams & { status?: SupportSubmissionStatus }
) {
  const { page = 1, pageSize = 20, search, status } = params;
  const offset = (page - 1) * pageSize;

  try {
    const conditions = [];
    if (status) {
      conditions.push(eq(supportSubmissions.status, status));
    }
    if (search) {
      conditions.push(
        sql`(${ilike(supportSubmissions.submitterName, `%${search}%`)} OR ${ilike(supportSubmissions.submitterEmail, `%${search}%`)} OR ${ilike(supportSubmissions.clientName, `%${search}%`)} OR ${ilike(supportSubmissions.title, `%${search}%`)})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: supportSubmissions.id,
          status: supportSubmissions.status,
          submitterName: supportSubmissions.submitterName,
          submitterEmail: supportSubmissions.submitterEmail,
          clientName: supportSubmissions.clientName,
          clientId: supportSubmissions.clientId,
          title: supportSubmissions.title,
          description: supportSubmissions.description,
          priority: supportSubmissions.priority,
          deviceType: supportSubmissions.deviceType,
          deviceBrand: supportSubmissions.deviceBrand,
          deviceModel: supportSubmissions.deviceModel,
          deviceSerialNumber: supportSubmissions.deviceSerialNumber,
          contactPhone: supportSubmissions.contactPhone,
          intercomUrl: supportSubmissions.intercomUrl,
          attachments: supportSubmissions.attachments,
          convertedIncidentId: supportSubmissions.convertedIncidentId,
          convertedByUserId: supportSubmissions.convertedByUserId,
          convertedAt: supportSubmissions.convertedAt,
          dismissedByUserId: supportSubmissions.dismissedByUserId,
          dismissedAt: supportSubmissions.dismissedAt,
          dismissReason: supportSubmissions.dismissReason,
          createdAt: supportSubmissions.createdAt,
          updatedAt: supportSubmissions.updatedAt,
          convertedIncidentNumber: incidents.incidentNumber,
          matchedClientName: clients.name,
        })
        .from(supportSubmissions)
        .leftJoin(incidents, eq(supportSubmissions.convertedIncidentId, incidents.id))
        .leftJoin(clients, eq(supportSubmissions.clientId, clients.id))
        .where(whereClause)
        .orderBy(desc(supportSubmissions.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(supportSubmissions)
        .where(whereClause),
    ]);

    const totalCount = totalResult[0].count;

    return {
      data: items as SupportSubmissionRow[],
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  } catch (err) {
    console.error("getSupportSubmissions error:", err);
    return { data: [] as SupportSubmissionRow[], totalCount: 0, page, pageSize, totalPages: 0 };
  }
}

export async function getPendingSubmissionsCount(): Promise<number> {
  try {
    const [result] = await db
      .select({ count: count() })
      .from(supportSubmissions)
      .where(eq(supportSubmissions.status, "pendiente"));
    return result.count;
  } catch {
    return 0;
  }
}

/** Find a client by name using ILIKE (case-insensitive match) */
export async function findClientByName(
  name: string
): Promise<{ id: string; name: string } | null> {
  if (!name || name.length < 2) return null;

  const [match] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(ilike(clients.name, name.trim()), isNull(clients.deletedAt)))
    .limit(1);

  return match ?? null;
}
