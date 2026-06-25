"use server";

import { db } from "@/lib/db";
import { rmas, providers, clients, eventLogs, incidents } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import { syncRmaTransition } from "@/lib/intercom/sync";
import { revalidatePath } from "next/cache";
import { getRequiredSession, requireRole } from "@/lib/auth/get-session";
import {
  createRmaSchema,
  updateRmaSchema,
  transitionRmaSchema,
} from "@/lib/validators/rma";
import { isValidRmaTransition } from "@/lib/state-machines/rma";
import { PAUSED_RMA_STATES } from "@/lib/constants/statuses";
import { generateSequentialId } from "@/lib/utils/id-generator";
import { getRmas, getRmaById } from "@/server/queries/rmas";
import type { ActionResult, PaginationParams, PaginatedResult } from "@/types";
import type { RmaRow } from "@/server/queries/rmas";
import type { RmaStatus } from "@/lib/constants/rmas";
import type { UserRole } from "@/lib/constants/roles";

export async function createRma(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = createRmaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const rmaNumber = await generateSequentialId("RMA");

  const [rma] = await db.transaction(async (tx) => {
    // Auto-fill clientName from client record if clientId is provided
    let clientName = parsed.data.clientName || null;
    if (parsed.data.clientId) {
      const [client] = await tx
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, parsed.data.clientId))
        .limit(1);
      if (client) clientName = client.name;
    }

    const [r] = await tx
      .insert(rmas)
      .values({
        rmaNumber,
        providerId: parsed.data.providerId,
        incidentId: parsed.data.incidentId || null,
        clientId: parsed.data.clientId || null,
        clientName,
        clientExternalId: parsed.data.clientExternalId || null,
        clientIntercomUrl: parsed.data.clientIntercomUrl || null,
        articleId: parsed.data.articleId || null,
        deviceType: parsed.data.deviceType || null,
        deviceBrand: parsed.data.deviceBrand || null,
        deviceModel: parsed.data.deviceModel || null,
        deviceSerialNumber: parsed.data.deviceSerialNumber || null,
        contactName: parsed.data.contactName || null,
        contactPhone: parsed.data.contactPhone || null,
        pickupAddress: parsed.data.pickupAddress || null,
        pickupPostalCode: parsed.data.pickupPostalCode || null,
        pickupCity: parsed.data.pickupCity || null,
        trackingNumberOutgoing: parsed.data.trackingNumberOutgoing || null,
        trackingNumberReturn: parsed.data.trackingNumberReturn || null,
        providerRmaNumber: parsed.data.providerRmaNumber || null,
        notes: parsed.data.notes || null,
      })
      .returning({ id: rmas.id });

    await tx.insert(eventLogs).values({
      entityType: "rma",
      entityId: r.id,
      action: "created",
      toState: "borrador",
      userId: session.user.id,
    });

    return [r];
  });

  revalidatePath("/rmas");
  return { success: true, data: { id: rma.id } };
}

export async function updateRma(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = updateRmaSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const fields = Object.keys(fieldErrors).join(", ");
    return { success: false, error: `Datos inválidos en: ${fields}` };
  }

  const values: Partial<typeof rmas.$inferInsert> = {};
  if (parsed.data.providerId !== undefined) values.providerId = parsed.data.providerId;
  if (parsed.data.incidentId !== undefined)
    values.incidentId = parsed.data.incidentId || null;
  if (parsed.data.clientId !== undefined)
    values.clientId = parsed.data.clientId || null;
  if (parsed.data.clientName !== undefined)
    values.clientName = parsed.data.clientName || null;
  if (parsed.data.clientExternalId !== undefined)
    values.clientExternalId = parsed.data.clientExternalId || null;
  if (parsed.data.clientIntercomUrl !== undefined)
    values.clientIntercomUrl = parsed.data.clientIntercomUrl || null;
  if (parsed.data.deviceType !== undefined)
    values.deviceType = parsed.data.deviceType || null;
  if (parsed.data.deviceBrand !== undefined)
    values.deviceBrand = parsed.data.deviceBrand || null;
  if (parsed.data.deviceModel !== undefined)
    values.deviceModel = parsed.data.deviceModel || null;
  if (parsed.data.deviceSerialNumber !== undefined)
    values.deviceSerialNumber = parsed.data.deviceSerialNumber || null;
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
  if (parsed.data.trackingNumberOutgoing !== undefined)
    values.trackingNumberOutgoing = parsed.data.trackingNumberOutgoing || null;
  if (parsed.data.trackingNumberReturn !== undefined)
    values.trackingNumberReturn = parsed.data.trackingNumberReturn || null;
  if (parsed.data.providerRmaNumber !== undefined)
    values.providerRmaNumber = parsed.data.providerRmaNumber || null;
  if (parsed.data.notes !== undefined)
    values.notes = parsed.data.notes || null;
  if (parsed.data.articleId !== undefined)
    values.articleId = parsed.data.articleId || null;
  if (parsed.data.outcome !== undefined)
    values.outcome = parsed.data.outcome || null;
  if (parsed.data.logistics !== undefined)
    values.logistics = parsed.data.logistics || null;
  if (parsed.data.repairPath !== undefined)
    values.repairPath = parsed.data.repairPath || null;
  if (parsed.data.shipping !== undefined)
    values.shipping = parsed.data.shipping;

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
    const [rma] = await db.transaction(async (tx) => {
      const [r] = await tx
        .update(rmas)
        .set(values)
        .where(eq(rmas.id, id))
        .returning({ id: rmas.id });

      if (!r) return [null];

      await tx.insert(eventLogs).values({
        entityType: "rma",
        entityId: r.id,
        action: "updated",
        userId: session.user.id,
        details: { fields: Object.keys(values) },
      });

      return [r];
    });

    if (!rma) {
      return { success: false, error: "RMA no encontrado" };
    }

    revalidatePath("/rmas");
    revalidatePath(`/rmas/${id}`);
    return { success: true, data: { id: rma.id } };
  } catch (err) {
    console.error("updateRma error:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al actualizar RMA: ${message}` };
  }
}

export async function transitionRma(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  const userRole = (session.user.role ?? "viewer") as UserRole;

  const parsed = transitionRmaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { rmaId, toStatus, comment, outcome } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        status: rmas.status,
        stateChangedAt: rmas.stateChangedAt,
        slaPausedMs: rmas.slaPausedMs,
      })
      .from(rmas)
      .where(eq(rmas.id, rmaId))
      .for("update")
      .limit(1);

    if (!current) {
      return { success: false as const, error: "RMA no encontrado" };
    }

    const fromStatus = current.status as RmaStatus;

    if (!isValidRmaTransition(fromStatus, toStatus as RmaStatus, userRole)) {
      return { success: false as const, error: "Transición de estado no permitida" };
    }

    const updateValues: Record<string, unknown> = {
      status: toStatus,
      stateChangedAt: new Date(),
    };

    // Pausa de SLA: al salir de un estado pausado (equipo en el proveedor),
    // acumular el tiempo pausado en slaPausedMs. Mismo patrón que incidencias.
    if ((PAUSED_RMA_STATES as readonly string[]).includes(fromStatus)) {
      const pausedSince = new Date(current.stateChangedAt).getTime();
      const pausedDuration = Math.max(0, Date.now() - pausedSince);
      const existingPaused = Number(current.slaPausedMs) || 0;
      updateValues.slaPausedMs = String(existingPaused + pausedDuration);
    }

    // Resultado capturado al cerrar/entregar/rechazar: se persiste junto al
    // cambio de estado para que la ficha nunca quede sin resultado.
    if (outcome) {
      updateValues.outcome = outcome;
    }

    await tx
      .update(rmas)
      .set(updateValues)
      .where(eq(rmas.id, rmaId));

    await tx.insert(eventLogs).values({
      entityType: "rma",
      entityId: rmaId,
      action: "transition",
      fromState: fromStatus,
      toState: toStatus,
      userId: session.user.id,
      details: comment ? { comment } : undefined,
    });

    return { success: true as const, fromStatus };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Auto-cierre de la incidencia vinculada: cuando el RMA se entrega al cliente
  // o se cierra, la incidencia (que estaba en "esperando_pieza") se marca como
  // resuelta. Se hace en contexto de request (la sesión sigue disponible) vía
  // transitionIncident para que la pausa de SLA y la nota a Intercom cuadren.
  if (toStatus === "entregado_cliente" || toStatus === "cerrado") {
    try {
      const [link] = await db
        .select({ incidentId: rmas.incidentId, rmaNumber: rmas.rmaNumber, incStatus: incidents.status })
        .from(rmas)
        .leftJoin(incidents, eq(rmas.incidentId, incidents.id))
        .where(eq(rmas.id, rmaId))
        .limit(1);
      if (link?.incidentId && link.incStatus && !["resuelto", "cerrado", "cancelado"].includes(link.incStatus)) {
        const { transitionIncident } = await import("@/server/actions/incidents");
        await transitionIncident({
          incidentId: link.incidentId,
          toStatus: "resuelto",
          comment: `Resuelta automáticamente al ${toStatus === "cerrado" ? "cerrar" : "entregar"} el RMA ${link.rmaNumber}.`,
        });
      }
    } catch (err) {
      console.error("[RMA] auto-cierre de incidencia falló:", err);
    }
  }

  // Sync note to Intercom after response using the linked incident's
  // Intercom references — RMAs don't have intercom fields directly.
  const fromStatusFinal = result.fromStatus;
  after(async () => {
    try {
      const [info] = await db.select({
        rmaNumber: rmas.rmaNumber,
        intercomUrl: incidents.intercomUrl,
        intercomEscalationId: incidents.intercomEscalationId,
      })
        .from(rmas)
        .leftJoin(incidents, eq(rmas.incidentId, incidents.id))
        .where(eq(rmas.id, rmaId))
        .limit(1);

      if (info && (info.intercomUrl || info.intercomEscalationId)) {
        await syncRmaTransition({
          intercomUrl: info.intercomUrl,
          intercomEscalationId: info.intercomEscalationId,
          rmaNumber: info.rmaNumber,
          fromStatus: fromStatusFinal,
          toStatus,
          comment,
        });
      }
    } catch (err) {
      console.error("[Intercom sync] transitionRma post-commit failed:", err);
    }
  });

  revalidatePath("/rmas");
  revalidatePath(`/rmas/${rmaId}`);
  return { success: true, data: { id: rmaId } };
}

export async function forceTransitionRma(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  await requireRole("admin");

  const parsed = transitionRmaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { rmaId, toStatus, comment } = parsed.data;

  let capturedFromStatus: RmaStatus | null = null;

  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: rmas.status })
        .from(rmas)
        .where(eq(rmas.id, rmaId))
        .for("update")
        .limit(1);

      if (!current) throw new Error("RMA no encontrado");

      capturedFromStatus = current.status as RmaStatus;

      await tx
        .update(rmas)
        .set({ status: toStatus, stateChangedAt: new Date() })
        .where(eq(rmas.id, rmaId));

      await tx.insert(eventLogs).values({
        entityType: "rma",
        entityId: rmaId,
        action: "transition",
        fromState: current.status,
        toState: toStatus,
        userId: session.user.id,
        details: {
          forced: true,
          ...(comment ? { comment } : {}),
        },
      });
    });

    // Sync note to Intercom after response
    if (capturedFromStatus) {
      const fromStatusFinal: RmaStatus = capturedFromStatus;
      after(async () => {
        try {
          const [info] = await db.select({
            rmaNumber: rmas.rmaNumber,
            intercomUrl: incidents.intercomUrl,
            intercomEscalationId: incidents.intercomEscalationId,
          })
            .from(rmas)
            .leftJoin(incidents, eq(rmas.incidentId, incidents.id))
            .where(eq(rmas.id, rmaId))
            .limit(1);

          if (info && (info.intercomUrl || info.intercomEscalationId)) {
            await syncRmaTransition({
              intercomUrl: info.intercomUrl,
              intercomEscalationId: info.intercomEscalationId,
              rmaNumber: info.rmaNumber,
              fromStatus: fromStatusFinal,
              toStatus,
              comment: comment ? `[Transición forzada] ${comment}` : "[Transición forzada]",
            });
          }
        } catch (err) {
          console.error("[Intercom sync] forceTransitionRma post-commit failed:", err);
        }
      });
    }

    revalidatePath("/rmas");
    revalidatePath(`/rmas/${rmaId}`);
    return { success: true, data: { id: rmaId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}

export async function fetchRmas(
  params: PaginationParams
): Promise<PaginatedResult<RmaRow>> {
  await getRequiredSession();
  return getRmas(params);
}

export async function fetchRmaById(id: string): Promise<RmaRow | null> {
  await getRequiredSession();
  return getRmaById(id);
}

export async function fetchProvidersForSelect(): Promise<
  { id: string; name: string }[]
> {
  await getRequiredSession();
  return db
    .select({ id: providers.id, name: providers.name })
    .from(providers)
    .where(isNull(providers.deletedAt))
    .orderBy(providers.name);
}
