"use server";

import { db } from "@/lib/db";
import { incidents, users, eventLogs } from "@/lib/db/schema";
import { eq, isNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import {
  createIncidentSchema,
  updateIncidentSchema,
  transitionIncidentSchema,
} from "@/lib/validators/incident";
import { isValidTransition } from "@/lib/state-machines/incident";
import { generateSequentialId } from "@/lib/utils/id-generator";
import { getIncidents } from "@/server/queries/incidents";
import type { ActionResult, PaginationParams, PaginatedResult } from "@/types";
import type { IncidentRow } from "@/server/queries/incidents";
import type { IncidentStatus } from "@/lib/constants/incidents";
import type { UserRole } from "@/lib/constants/roles";

export async function createIncident(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = createIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const incidentNumber = await generateSequentialId("INC");

  const [incident] = await db.transaction(async (tx) => {
    const [inc] = await tx
      .insert(incidents)
      .values({
        incidentNumber,
        clientName: parsed.data.clientName || null,
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: parsed.data.category,
        priority: parsed.data.priority,
        assignedUserId: parsed.data.assignedUserId || null,
        deviceType: parsed.data.deviceType || null,
        deviceBrand: parsed.data.deviceBrand || null,
        deviceModel: parsed.data.deviceModel || null,
        deviceSerialNumber: parsed.data.deviceSerialNumber || null,
      })
      .returning({ id: incidents.id });

    await tx.insert(eventLogs).values({
      entityType: "incident",
      entityId: inc.id,
      action: "created",
      toState: "nuevo",
      userId: session.user.id,
    });

    return [inc];
  });

  revalidatePath("/incidents");
  return { success: true, data: { id: incident.id } };
}

export async function updateIncident(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = updateIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const values: Record<string, unknown> = {};
  if (parsed.data.clientName !== undefined) values.clientName = parsed.data.clientName || null;
  if (parsed.data.title) values.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    values.description = parsed.data.description || null;
  if (parsed.data.category) values.category = parsed.data.category;
  if (parsed.data.priority) values.priority = parsed.data.priority;
  if (parsed.data.assignedUserId !== undefined)
    values.assignedUserId = parsed.data.assignedUserId || null;
  if (parsed.data.deviceType !== undefined)
    values.deviceType = parsed.data.deviceType || null;
  if (parsed.data.deviceBrand !== undefined)
    values.deviceBrand = parsed.data.deviceBrand || null;
  if (parsed.data.deviceModel !== undefined)
    values.deviceModel = parsed.data.deviceModel || null;
  if (parsed.data.deviceSerialNumber !== undefined)
    values.deviceSerialNumber = parsed.data.deviceSerialNumber || null;

  const [incident] = await db.transaction(async (tx) => {
    const [inc] = await tx
      .update(incidents)
      .set(values)
      .where(eq(incidents.id, id))
      .returning({ id: incidents.id });

    if (!inc) return [null];

    await tx.insert(eventLogs).values({
      entityType: "incident",
      entityId: inc.id,
      action: "updated",
      userId: session.user.id,
      details: { fields: Object.keys(values) },
    });

    return [inc];
  });

  if (!incident) {
    return { success: false, error: "Incidencia no encontrada" };
  }

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${id}`);
  return { success: true, data: { id: incident.id } };
}

export async function transitionIncident(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  const userRole = (session.user.role ?? "viewer") as UserRole;

  const parsed = transitionIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { incidentId, toStatus, comment } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: incidents.status })
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .for("update")
      .limit(1);

    if (!current) {
      return { success: false as const, error: "Incidencia no encontrada" };
    }

    const fromStatus = current.status as IncidentStatus;

    if (!isValidTransition(fromStatus, toStatus as IncidentStatus, userRole)) {
      return { success: false as const, error: "Transición de estado no permitida" };
    }

    const updateValues: Record<string, unknown> = {
      status: toStatus,
      stateChangedAt: new Date(),
    };

    if (toStatus === "resuelto") {
      updateValues.resolvedAt = new Date();
    } else if (fromStatus === "resuelto" && toStatus !== "cerrado") {
      updateValues.resolvedAt = null;
    }

    await tx
      .update(incidents)
      .set(updateValues)
      .where(eq(incidents.id, incidentId));

    await tx.insert(eventLogs).values({
      entityType: "incident",
      entityId: incidentId,
      action: "transition",
      fromState: fromStatus,
      toState: toStatus,
      userId: session.user.id,
      details: comment ? { comment } : undefined,
    });

    return { success: true as const };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${incidentId}`);
  return { success: true, data: { id: incidentId } };
}

export async function fetchIncidents(
  params: PaginationParams
): Promise<PaginatedResult<IncidentRow>> {
  await getRequiredSession();
  return getIncidents(params);
}

export async function fetchUsersForSelect(): Promise<
  { id: string; name: string }[]
> {
  await getRequiredSession();
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(users.name);
}

export async function fetchIncidentsForSelect(): Promise<
  { id: string; incidentNumber: string }[]
> {
  await getRequiredSession();
  return db
    .select({ id: incidents.id, incidentNumber: incidents.incidentNumber })
    .from(incidents)
    .where(notInArray(incidents.status, ["cerrado", "cancelado"]))
    .orderBy(incidents.incidentNumber);
}
