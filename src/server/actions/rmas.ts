"use server";

import { db } from "@/lib/db";
import { rmas, providers, clients, eventLogs } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import {
  createRmaSchema,
  updateRmaSchema,
  transitionRmaSchema,
} from "@/lib/validators/rma";
import { isValidRmaTransition } from "@/lib/state-machines/rma";
import { generateSequentialId } from "@/lib/utils/id-generator";
import { getRmas } from "@/server/queries/rmas";
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
    const [r] = await tx
      .insert(rmas)
      .values({
        rmaNumber,
        providerId: parsed.data.providerId,
        incidentId: parsed.data.incidentId || null,
        clientId: parsed.data.clientId || null,
        deviceType: parsed.data.deviceType || null,
        deviceBrand: parsed.data.deviceBrand || null,
        deviceModel: parsed.data.deviceModel || null,
        deviceSerialNumber: parsed.data.deviceSerialNumber || null,
        clientLocal: parsed.data.clientLocal || null,
        address: parsed.data.address || null,
        postalCode: parsed.data.postalCode || null,
        phone: parsed.data.phone || null,
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
    return { success: false, error: "Datos inválidos" };
  }

  const values: Record<string, unknown> = {};
  if (parsed.data.providerId) values.providerId = parsed.data.providerId;
  if (parsed.data.incidentId !== undefined)
    values.incidentId = parsed.data.incidentId || null;
  if (parsed.data.clientId !== undefined)
    values.clientId = parsed.data.clientId || null;
  if (parsed.data.deviceType !== undefined)
    values.deviceType = parsed.data.deviceType || null;
  if (parsed.data.deviceBrand !== undefined)
    values.deviceBrand = parsed.data.deviceBrand || null;
  if (parsed.data.deviceModel !== undefined)
    values.deviceModel = parsed.data.deviceModel || null;
  if (parsed.data.deviceSerialNumber !== undefined)
    values.deviceSerialNumber = parsed.data.deviceSerialNumber || null;
  if (parsed.data.clientLocal !== undefined)
    values.clientLocal = parsed.data.clientLocal || null;
  if (parsed.data.address !== undefined)
    values.address = parsed.data.address || null;
  if (parsed.data.postalCode !== undefined)
    values.postalCode = parsed.data.postalCode || null;
  if (parsed.data.phone !== undefined)
    values.phone = parsed.data.phone || null;
  if (parsed.data.trackingNumberOutgoing !== undefined)
    values.trackingNumberOutgoing = parsed.data.trackingNumberOutgoing || null;
  if (parsed.data.trackingNumberReturn !== undefined)
    values.trackingNumberReturn = parsed.data.trackingNumberReturn || null;
  if (parsed.data.providerRmaNumber !== undefined)
    values.providerRmaNumber = parsed.data.providerRmaNumber || null;
  if (parsed.data.notes !== undefined)
    values.notes = parsed.data.notes || null;

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

  const { rmaId, toStatus, comment } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: rmas.status })
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

    await tx
      .update(rmas)
      .set({
        status: toStatus,
        stateChangedAt: new Date(),
      })
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

    return { success: true as const };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/rmas");
  revalidatePath(`/rmas/${rmaId}`);
  return { success: true, data: { id: rmaId } };
}

export async function fetchRmas(
  params: PaginationParams
): Promise<PaginatedResult<RmaRow>> {
  await getRequiredSession();
  return getRmas(params);
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

export async function fetchClientsForRmaSelect(): Promise<
  { id: string; name: string }[]
> {
  await getRequiredSession();
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(clients.name);
}
