"use server";

import { db } from "@/lib/db";
import { clients, clientLocations, eventLogs } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import {
  createClientSchema,
  updateClientSchema,
  createClientLocationSchema,
  updateClientLocationSchema,
} from "@/lib/validators/client";
import { getClients, getClientLocations } from "@/server/queries/clients";
import type { ActionResult, PaginationParams, PaginatedResult } from "@/types";
import type { ClientRow, ClientLocationRow } from "@/server/queries/clients";

export async function createClient(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const [client] = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(clients)
      .values({
        name: parsed.data.name,
        externalId: parsed.data.externalId || null,
        intercomUrl: parsed.data.intercomUrl || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        contactName: parsed.data.contactName || null,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        postalCode: parsed.data.postalCode || null,
        notes: parsed.data.notes || null,
      })
      .returning({ id: clients.id });

    await tx.insert(eventLogs).values({
      entityType: "client",
      entityId: c.id,
      action: "created",
      userId: session.user.id,
    });

    return [c];
  });

  revalidatePath("/clients");
  return { success: true, data: { id: client.id } };
}

export async function updateClient(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();

  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const values: Record<string, unknown> = {};
  if (parsed.data.name) values.name = parsed.data.name;
  if (parsed.data.externalId !== undefined) values.externalId = parsed.data.externalId || null;
  if (parsed.data.intercomUrl !== undefined) values.intercomUrl = parsed.data.intercomUrl || null;
  if (parsed.data.email !== undefined) values.email = parsed.data.email || null;
  if (parsed.data.phone !== undefined) values.phone = parsed.data.phone || null;
  if (parsed.data.contactName !== undefined) values.contactName = parsed.data.contactName || null;
  if (parsed.data.address !== undefined) values.address = parsed.data.address || null;
  if (parsed.data.city !== undefined) values.city = parsed.data.city || null;
  if (parsed.data.postalCode !== undefined) values.postalCode = parsed.data.postalCode || null;
  if (parsed.data.notes !== undefined) values.notes = parsed.data.notes || null;

  const [client] = await db.transaction(async (tx) => {
    const [c] = await tx
      .update(clients)
      .set(values)
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .returning({ id: clients.id });

    if (!c) return [null];

    await tx.insert(eventLogs).values({
      entityType: "client",
      entityId: c.id,
      action: "updated",
      userId: session.user.id,
      details: { fields: Object.keys(values) },
    });

    return [c];
  });

  if (!client) {
    return { success: false, error: "Cliente no encontrado" };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: true, data: { id: client.id } };
}

export async function deleteClient(
  id: string
): Promise<ActionResult> {
  await getRequiredSession();

  const [client] = await db
    .update(clients)
    .set({ deletedAt: new Date() })
    .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
    .returning({ id: clients.id });

  if (!client) {
    return { success: false, error: "Cliente no encontrado" };
  }

  revalidatePath("/clients");
  return { success: true, data: undefined };
}

export async function createClientLocation(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();

  const parsed = createClientLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const [location] = await db
    .insert(clientLocations)
    .values({
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      contactName: parsed.data.contactName || null,
      contactEmail: parsed.data.contactEmail || null,
      contactPhone: parsed.data.contactPhone || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      postalCode: parsed.data.postalCode || null,
      notes: parsed.data.notes || null,
      isDefault: parsed.data.isDefault ?? false,
    })
    .returning({ id: clientLocations.id });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true, data: { id: location.id } };
}

export async function updateClientLocation(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();

  const parsed = updateClientLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const values: Record<string, unknown> = {};
  if (parsed.data.name) values.name = parsed.data.name;
  if (parsed.data.contactName !== undefined) values.contactName = parsed.data.contactName || null;
  if (parsed.data.contactEmail !== undefined) values.contactEmail = parsed.data.contactEmail || null;
  if (parsed.data.contactPhone !== undefined) values.contactPhone = parsed.data.contactPhone || null;
  if (parsed.data.address !== undefined) values.address = parsed.data.address || null;
  if (parsed.data.city !== undefined) values.city = parsed.data.city || null;
  if (parsed.data.postalCode !== undefined) values.postalCode = parsed.data.postalCode || null;
  if (parsed.data.notes !== undefined) values.notes = parsed.data.notes || null;
  if (parsed.data.isDefault !== undefined) values.isDefault = parsed.data.isDefault;

  const [location] = await db
    .update(clientLocations)
    .set(values)
    .where(eq(clientLocations.id, id))
    .returning({ id: clientLocations.id, clientId: clientLocations.clientId });

  if (!location) {
    return { success: false, error: "Local no encontrado" };
  }

  revalidatePath(`/clients/${location.clientId}`);
  return { success: true, data: { id: location.id } };
}

export async function deleteClientLocation(
  id: string
): Promise<ActionResult> {
  await getRequiredSession();

  const [location] = await db
    .delete(clientLocations)
    .where(eq(clientLocations.id, id))
    .returning({ clientId: clientLocations.clientId });

  if (!location) {
    return { success: false, error: "Local no encontrado" };
  }

  revalidatePath(`/clients/${location.clientId}`);
  return { success: true, data: undefined };
}

export async function fetchClients(
  params: PaginationParams
): Promise<PaginatedResult<ClientRow>> {
  await getRequiredSession();
  return getClients(params);
}

export async function fetchClientsForSelect(): Promise<
  { id: string; name: string }[]
> {
  await getRequiredSession();
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(clients.name);
}

export async function fetchClientLocationsForSelect(
  clientId: string
): Promise<ClientLocationRow[]> {
  await getRequiredSession();
  return getClientLocations(clientId);
}
