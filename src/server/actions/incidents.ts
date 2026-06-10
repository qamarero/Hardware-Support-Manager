"use server";

import { db } from "@/lib/db";
import { incidents, users, clients, eventLogs } from "@/lib/db/schema";
import { eq, and, isNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getRequiredSession, requireRole } from "@/lib/auth/get-session";
import {
  createIncidentSchema,
  updateIncidentSchema,
  transitionIncidentSchema,
  createQuickConsultationSchema,
  convertQuickConsultationSchema,
} from "@/lib/validators/incident";
import { isValidTransition } from "@/lib/state-machines/incident";
import { generateSequentialId } from "@/lib/utils/id-generator";
import { getIncidents, getIncidentById, getLinkedRmas } from "@/server/queries/incidents";
import type { ActionResult, PaginationParams, PaginatedResult } from "@/types";
import type { IncidentRow, LinkedRma } from "@/server/queries/incidents";
import { syncIncidentTransition } from "@/lib/intercom/sync";
import type { IncidentStatus } from "@/lib/constants/incidents";
import type { UserRole } from "@/lib/constants/roles";
import { PAUSED_INCIDENT_STATES } from "@/lib/constants/statuses";

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
        hardwareOrigin: parsed.data.hardwareOrigin,
        priority: parsed.data.priority,
        slaHours: parsed.data.slaHours ?? null,
        assignedUserId: parsed.data.assignedUserId || null,
        articleId: parsed.data.articleId || null,
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
  if (parsed.data.hardwareOrigin !== undefined) values.hardwareOrigin = parsed.data.hardwareOrigin;
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
  if (parsed.data.slaHours !== undefined) values.slaHours = parsed.data.slaHours ?? null;
  if (parsed.data.diagnosis !== undefined) values.diagnosis = parsed.data.diagnosis || null;
  if (parsed.data.resolution !== undefined) values.resolution = parsed.data.resolution || null;

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

    // SLA pause accumulation: when leaving a paused state, add the time spent paused.
    // Validate numeric value to prevent CAST(sla_paused_ms AS bigint) failures in queries.
    if ((PAUSED_INCIDENT_STATES as readonly string[]).includes(fromStatus)) {
      const pausedSince = new Date(current.stateChangedAt).getTime();
      const pausedDuration = Math.max(0, Date.now() - pausedSince);
      const existingPaused = Number(current.slaPausedMs) || 0;
      const newTotal = Math.floor(existingPaused + pausedDuration);
      updateValues.slaPausedMs = String(newTotal);
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

    return { success: true as const, fromStatus };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Sync note to Intercom after the response is sent. `after()` guarantees
  // the work runs even in serverless (Vercel may freeze the instance otherwise).
  after(async () => {
    try {
      const [inc] = await db.select({
        intercomUrl: incidents.intercomUrl,
        intercomEscalationId: incidents.intercomEscalationId,
        incidentNumber: incidents.incidentNumber,
      })
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);

      if (inc?.intercomUrl || inc?.intercomEscalationId) {
        await syncIncidentTransition({
          intercomUrl: inc.intercomUrl,
          intercomEscalationId: inc.intercomEscalationId,
          incidentNumber: inc.incidentNumber,
          fromStatus: result.fromStatus,
          toStatus,
          comment,
        });
      }
    } catch (err) {
      console.error("[Intercom sync] transitionIncident post-commit failed:", err);
    }
  });

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

  let capturedFromStatus: IncidentStatus | null = null;

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
      capturedFromStatus = fromStatus;
      const updateValues: Record<string, unknown> = {
        status: toStatus,
        stateChangedAt: new Date(),
      };

      if ((PAUSED_INCIDENT_STATES as readonly string[]).includes(fromStatus)) {
        const pausedSince = new Date(current.stateChangedAt).getTime();
        const pausedDuration = Math.max(0, Date.now() - pausedSince);
        const existingPaused = Math.max(0, Number(current.slaPausedMs ?? 0));
        updateValues.slaPausedMs = String(Math.floor(existingPaused + pausedDuration));
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

    // Sync note to Intercom after response (waitUntil ensures execution in serverless)
    if (capturedFromStatus) {
      const fromStatusFinal = capturedFromStatus;
      after(async () => {
        try {
          const [inc] = await db.select({
            intercomUrl: incidents.intercomUrl,
            intercomEscalationId: incidents.intercomEscalationId,
            incidentNumber: incidents.incidentNumber,
          })
            .from(incidents)
            .where(eq(incidents.id, incidentId))
            .limit(1);

          if (inc?.intercomUrl || inc?.intercomEscalationId) {
            await syncIncidentTransition({
              intercomUrl: inc.intercomUrl,
              intercomEscalationId: inc.intercomEscalationId,
              incidentNumber: inc.incidentNumber,
              fromStatus: fromStatusFinal,
              toStatus,
              comment: comment ? `[Transición forzada] ${comment}` : "[Transición forzada]",
            });
          }
        } catch (err) {
          console.error("[Intercom sync] forceTransitionIncident post-commit failed:", err);
        }
      });
    }

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
  { id: string; name: string; avatarUrl: string | null }[]
> {
  await getRequiredSession();
  return db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(users.name);
}

/**
 * Quick-assign action: update only `assignedUserId` on an incident.
 *
 * Lightweight alternative to `updateIncident()` — no need to send the full
 * form payload. Used by the AssigneeQuickPicker in both list and detail
 * views to change/clear the assigned technician in a single click.
 *
 * Logs an `updated` event for the audit trail. Pass `userId = null` to
 * unassign.
 */
export async function quickAssignIncident(
  incidentId: string,
  userId: string | null
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  try {
    // Verify the target user exists (if not null)
    if (userId) {
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);
      if (!target) {
        return { success: false, error: "Usuario no encontrado" };
      }
    }

    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ assignedUserId: incidents.assignedUserId })
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);

      if (!current) {
        return { ok: false as const, error: "Incidencia no encontrada" };
      }

      // No-op if already assigned to the same user
      if (current.assignedUserId === userId) {
        return { ok: true as const, changed: false };
      }

      await tx
        .update(incidents)
        .set({ assignedUserId: userId })
        .where(eq(incidents.id, incidentId));

      await tx.insert(eventLogs).values({
        entityType: "incident",
        entityId: incidentId,
        action: "updated",
        userId: session.user.id,
        details: {
          quickAssign: true,
          previousAssignedUserId: current.assignedUserId,
          newAssignedUserId: userId,
        },
      });

      return { ok: true as const, changed: true };
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    if (result.changed) {
      revalidatePath("/incidents");
      revalidatePath(`/incidents/${incidentId}`);
    }
    return { success: true, data: { id: incidentId } };
  } catch (err) {
    console.error("quickAssignIncident error:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al asignar: ${message}` };
  }
}

export async function fetchIncidentsForSelect(): Promise<
  { id: string; incidentNumber: string }[]
> {
  await getRequiredSession();
  return db
    .select({ id: incidents.id, incidentNumber: incidents.incidentNumber })
    .from(incidents)
    .where(notInArray(incidents.status, ["cerrado", "cancelado", "resuelto"]))
    .orderBy(incidents.incidentNumber)
    .limit(500);
}

export async function fetchIncidentById(id: string): Promise<IncidentRow | null> {
  await getRequiredSession();
  return getIncidentById(id);
}

export async function fetchLinkedRmas(incidentId: string): Promise<LinkedRma[]> {
  await getRequiredSession();
  return getLinkedRmas(incidentId);
}

export async function quickTransitionToGestion(
  incidentId: string,
  comment?: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

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

    if (current.status !== "nuevo") {
      return { success: false as const, error: "Solo se puede usar desde estado 'nuevo'" };
    }

    // Update directly to en_gestion
    await tx
      .update(incidents)
      .set({ status: "en_gestion", stateChangedAt: new Date() })
      .where(eq(incidents.id, incidentId));

    // Create 2 event log entries for audit trail
    const details = comment ? { comment } : undefined;

    await tx.insert(eventLogs).values([
      {
        entityType: "incident" as const,
        entityId: incidentId,
        action: "transition" as const,
        fromState: "nuevo",
        toState: "en_triaje",
        userId: session.user.id,
        details: { ...details, quickTransition: true },
      },
      {
        entityType: "incident" as const,
        entityId: incidentId,
        action: "transition" as const,
        fromState: "en_triaje",
        toState: "en_gestion",
        userId: session.user.id,
        details: { ...details, quickTransition: true },
      },
    ]);

    return { success: true as const };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Sync note to Intercom after response. Reports the final state (en_gestion).
  after(async () => {
    try {
      const [inc] = await db.select({
        intercomUrl: incidents.intercomUrl,
        intercomEscalationId: incidents.intercomEscalationId,
        incidentNumber: incidents.incidentNumber,
      })
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);

      if (inc?.intercomUrl || inc?.intercomEscalationId) {
        await syncIncidentTransition({
          intercomUrl: inc.intercomUrl,
          intercomEscalationId: inc.intercomEscalationId,
          incidentNumber: inc.incidentNumber,
          fromStatus: "nuevo",
          toStatus: "en_gestion",
          comment: comment ? `[Inicio rápido de gestión] ${comment}` : "[Inicio rápido de gestión]",
        });
      }
    } catch (err) {
      console.error("[Intercom sync] quickTransitionToGestion post-commit failed:", err);
    }
  });

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${incidentId}`);
  return { success: true, data: { id: incidentId } };
}

// ─── Quick consultations ────────────────────────────────────────────────────
//
// In-situ quick consultations: incidencias creadas YA resueltas para registrar
// el tiempo invertido en consultas que el técnico atiende en su mesa en pocos
// minutos. Se diferencian con `category='consulta_rapida'` y NO contaminan los
// cálculos SLA (las queries de getSlaMetrics las excluyen explícitamente).

/**
 * Crea una consulta rápida (incidencia ya resuelta).
 *
 * Defaults aplicados:
 *   - status='resuelto', resolvedAt=now(), createdAt=now()
 *   - category='consulta_rapida', priority='baja', hardwareOrigin='qamarero'
 *   - assignedUserId = session.user.id (el técnico que la atendió)
 *
 * eventLog registra 2 eventos: 'created' (toState='nuevo') y 'transition'
 * (fromState='nuevo' → toState='resuelto') para mantener auditoría coherente
 * con el resto del sistema.
 */
export async function createQuickConsultation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = createQuickConsultationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const fields = Object.keys(fieldErrors).join(", ");
    return { success: false, error: `Datos inválidos en: ${fields}` };
  }

  const incidentNumber = await generateSequentialId("INC");
  const now = new Date();

  const [createdInc] = await db.transaction(async (tx) => {
    const [inc] = await tx
      .insert(incidents)
      .values({
        incidentNumber,
        clientName: parsed.data.clientName || null,
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: "consulta_rapida",
        hardwareOrigin: "qamarero",
        priority: "baja",
        status: "resuelto",
        assignedUserId: session.user.id,
        createdAt: now,
        updatedAt: now,
        resolvedAt: now,
        stateChangedAt: now,
        quickDurationMinutes: parsed.data.durationMinutes ?? null,
      })
      .returning({ id: incidents.id });

    // Auditoría coherente con el resto: dos eventos en orden — created y
    // transición directa a resuelto.
    await tx.insert(eventLogs).values({
      entityType: "incident",
      entityId: inc.id,
      action: "created",
      toState: "nuevo",
      userId: session.user.id,
      details: { kind: "quick_consultation" },
    });

    await tx.insert(eventLogs).values({
      entityType: "incident",
      entityId: inc.id,
      action: "transition",
      fromState: "nuevo",
      toState: "resuelto",
      userId: session.user.id,
      details: {
        kind: "quick_consultation",
        durationMinutes: parsed.data.durationMinutes ?? null,
      },
    });

    return [inc];
  });

  revalidatePath("/incidents");
  revalidatePath("/dashboard");
  return { success: true, data: { id: createdInc.id } };
}

/**
 * Convierte una consulta rápida en incidencia formal (escalado / directa).
 *
 * Cambia category, status, hardwareOrigin y priority. Reabre la incidencia
 * (resolvedAt → null) y reinicia el reloj SLA (stateChangedAt = now()).
 *
 * `quickDurationMinutes` se PRESERVA — registra el tiempo previo al escalado,
 * útil como contexto cuando se cierre formalmente.
 */
export async function convertQuickConsultation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = convertQuickConsultationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const fields = Object.keys(fieldErrors).join(", ");
    return { success: false, error: `Datos inválidos en: ${fields}` };
  }

  const [current] = await db
    .select({
      id: incidents.id,
      category: incidents.category,
      status: incidents.status,
    })
    .from(incidents)
    .where(eq(incidents.id, parsed.data.incidentId))
    .limit(1);

  if (!current) {
    return { success: false, error: "Incidencia no encontrada" };
  }

  if (current.category !== "consulta_rapida") {
    return {
      success: false,
      error: "Solo se pueden convertir consultas rápidas",
    };
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(incidents)
      .set({
        category: parsed.data.toCategory,
        status: parsed.data.toStatus,
        hardwareOrigin: parsed.data.hardwareOrigin,
        priority: parsed.data.priority,
        resolvedAt: null,
        stateChangedAt: now,
        updatedAt: now,
      })
      .where(eq(incidents.id, parsed.data.incidentId));

    await tx.insert(eventLogs).values({
      entityType: "incident",
      entityId: parsed.data.incidentId,
      action: "converted_from_quick",
      fromState: current.status,
      toState: parsed.data.toStatus,
      userId: session.user.id,
      details: {
        toCategory: parsed.data.toCategory,
        priority: parsed.data.priority,
        hardwareOrigin: parsed.data.hardwareOrigin,
        comment: parsed.data.comment ?? null,
      },
    });
  });

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${parsed.data.incidentId}`);
  revalidatePath("/dashboard");
  return { success: true, data: { id: parsed.data.incidentId } };
}
