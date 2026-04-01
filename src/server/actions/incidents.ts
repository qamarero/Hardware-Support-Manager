"use server";

import { db } from "@/lib/db";
import { incidents, users, clients, eventLogs } from "@/lib/db/schema";
import { eq, isNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession, requireRole } from "@/lib/auth/get-session";
import {
  createIncidentSchema,
  updateIncidentSchema,
  transitionIncidentSchema,
} from "@/lib/validators/incident";
import { isValidTransition } from "@/lib/state-machines/incident";
import { generateSequentialId } from "@/lib/utils/id-generator";
import { getIncidents, getIncidentById, getLinkedRmas } from "@/server/queries/incidents";
import type { ActionResult, PaginationParams, PaginatedResult } from "@/types";
import type { IncidentRow, LinkedRma } from "@/server/queries/incidents";
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

  // Auto-fill clientName from client record if clientId is provided
  let clientName = parsed.data.clientName || null;
  if (parsed.data.clientId) {
    const [client] = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, parsed.data.clientId))
      .limit(1);
    if (client) clientName = client.name;
  }

  const [incident] = await db.transaction(async (tx) => {
    const [inc] = await tx
      .insert(incidents)
      .values({
        incidentNumber,
        clientId: parsed.data.clientId || null,
        clientLocationId: parsed.data.clientLocationId || null,
        clientName,
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: parsed.data.category,
        priority: parsed.data.priority,
        assignedUserId: parsed.data.assignedUserId || null,
        deviceType: parsed.data.deviceType || null,
        deviceBrand: parsed.data.deviceBrand || null,
        deviceModel: parsed.data.deviceModel || null,
        deviceSerialNumber: parsed.data.deviceSerialNumber || null,
        intercomUrl: parsed.data.intercomUrl || null,
        intercomEscalationId: parsed.data.intercomEscalationId || null,
        contactName: parsed.data.contactName || null,
        contactPhone: parsed.data.contactPhone || null,
        pickupAddress: parsed.data.pickupAddress || null,
        pickupPostalCode: parsed.data.pickupPostalCode || null,
        pickupCity: parsed.data.pickupCity || null,
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
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const fields = Object.keys(fieldErrors).join(", ");
    return { success: false, error: `Datos inválidos en: ${fields}` };
  }

  const values: Partial<typeof incidents.$inferInsert> = {};
  if (parsed.data.clientId !== undefined) values.clientId = parsed.data.clientId || null;
  if (parsed.data.clientLocationId !== undefined) values.clientLocationId = parsed.data.clientLocationId || null;
  if (parsed.data.clientName !== undefined) values.clientName = parsed.data.clientName || null;
  if (parsed.data.title !== undefined) values.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    values.description = parsed.data.description || null;
  if (parsed.data.category !== undefined) values.category = parsed.data.category;
  if (parsed.data.priority !== undefined) values.priority = parsed.data.priority;
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
  if (parsed.data.intercomUrl !== undefined)
    values.intercomUrl = parsed.data.intercomUrl || null;
  if (parsed.data.intercomEscalationId !== undefined)
    values.intercomEscalationId = parsed.data.intercomEscalationId || null;
  if (parsed.data.contactName !== undefined)
    values.contactName = parsed.data.contactName || null;
  if (parsed.data.contactPhone !== undefined)
    values.contactPhone = parsed.data.contactPhone || null;
  if (parsed.data.pickupAddress !== undefined)
    values.pickupAddress = parsed.data.pickupAddress || null;
  if (parsed.data.pickupPostalCode !== undefined)
    values.pickupPostalCode = parsed.data.pickupPostalCode || null;
  if (parsed.data.pickupCity !== undefined)
    values.pickupCity = parsed.data.pickupCity || null;

  // Auto-fill clientName from client record if clientId changed
  if (values.clientId) {
    const [client] = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, values.clientId))
      .limit(1);
    if (client) values.clientName = client.name;
  }

  try {
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
  } catch (err) {
    console.error("updateIncident error:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al actualizar incidencia: ${message}` };
  }
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

  const { incidentId, toStatus, comment, resolutionType } = parsed.data;

  // States where SLA clock is paused (waiting on external parties)
  const PAUSED_STATES: IncidentStatus[] = ["esperando_cliente", "esperando_proveedor"];

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        status: incidents.status,
        stateChangedAt: incidents.stateChangedAt,
        slaPausedMs: incidents.slaPausedMs,
      })
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

    // SLA pause accumulation: when leaving a paused state, add the time spent paused
    if (PAUSED_STATES.includes(fromStatus)) {
      const pausedSince = new Date(current.stateChangedAt).getTime();
      const pausedDuration = Date.now() - pausedSince;
      const existingPaused = parseInt(current.slaPausedMs || "0", 10);
      updateValues.slaPausedMs = String(existingPaused + pausedDuration);
    }

    if (toStatus === "resuelto") {
      updateValues.resolvedAt = new Date();
      updateValues.resolutionType = resolutionType || "standard";
    } else if (fromStatus === "resuelto" && toStatus !== "cerrado") {
      updateValues.resolvedAt = null;
      updateValues.resolutionType = null;
    }

    await tx
      .update(incidents)
      .set(updateValues)
      .where(eq(incidents.id, incidentId));

    const eventDetails: Record<string, unknown> = {};
    if (comment) eventDetails.comment = comment;
    if (resolutionType === "derivado_rma") eventDetails.resolutionType = "derivado_rma";

    await tx.insert(eventLogs).values({
      entityType: "incident",
      entityId: incidentId,
      action: "transition",
      fromState: fromStatus,
      toState: toStatus,
      userId: session.user.id,
      details: Object.keys(eventDetails).length > 0 ? eventDetails : undefined,
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

export async function forceTransitionIncident(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  await requireRole("admin");

  const parsed = transitionIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { incidentId, toStatus, comment } = parsed.data;

  const PAUSED_STATES: IncidentStatus[] = ["esperando_cliente", "esperando_proveedor"];

  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          status: incidents.status,
          stateChangedAt: incidents.stateChangedAt,
          slaPausedMs: incidents.slaPausedMs,
        })
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .for("update")
        .limit(1);

      if (!current) throw new Error("Incidencia no encontrada");

      const fromStatus = current.status as IncidentStatus;
      const updateValues: Record<string, unknown> = {
        status: toStatus,
        stateChangedAt: new Date(),
      };

      if (PAUSED_STATES.includes(fromStatus)) {
        const pausedSince = new Date(current.stateChangedAt).getTime();
        const pausedDuration = Date.now() - pausedSince;
        const existingPaused = parseInt(current.slaPausedMs || "0", 10);
        updateValues.slaPausedMs = String(existingPaused + pausedDuration);
      }

      if (toStatus === "resuelto") {
        updateValues.resolvedAt = new Date();
        updateValues.resolutionType = "standard";
      } else if (fromStatus === "resuelto") {
        updateValues.resolvedAt = null;
        updateValues.resolutionType = null;
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
        details: {
          forced: true,
          ...(comment ? { comment } : {}),
        },
      });
    });

    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
    return { success: true, data: { id: incidentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
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

export async function fetchIncidentById(id: string): Promise<IncidentRow | null> {
  await getRequiredSession();
  return getIncidentById(id);
}

export async function fetchLinkedRmas(incidentId: string): Promise<LinkedRma[]> {
  await getRequiredSession();
  return getLinkedRmas(incidentId);
}
