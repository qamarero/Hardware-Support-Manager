"use server";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import { createClientSchema, updateClientSchema, quickCreateClientSchema } from "@/lib/validators/client";
import { getClients } from "@/server/queries/clients";
import type { ActionResult, PaginationParams, PaginatedResult } from "@/types";
import type { ClientRow } from "@/server/queries/clients";

export async function createClient(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();

  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const [client] = await db
    .insert(clients)
    .values(parsed.data)
    .returning({ id: clients.id });

  revalidatePath("/clients");
  return { success: true, data: { id: client.id } };
}

export async function updateClient(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();

  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const [client] = await db
    .update(clients)
    .set(parsed.data)
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

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
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

  if (!client) {
    return { success: false, error: "Cliente no encontrado" };
  }

  revalidatePath("/clients");
  return { success: true, data: undefined };
}

export async function quickCreateClient(
  input: unknown
): Promise<ActionResult<{ id: string; name: string }>> {
  await getRequiredSession();

  const parsed = quickCreateClientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  // Check for duplicate clientCode
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.clientCode, parsed.data.clientCode), isNull(clients.deletedAt)))
    .limit(1);

  if (existing) {
    return { success: false, error: `Ya existe un cliente con el ID "${parsed.data.clientCode}"` };
  }

  const [client] = await db
    .insert(clients)
    .values({
      clientCode: parsed.data.clientCode,
      name: parsed.data.name,
    })
    .returning({ id: clients.id, name: clients.name });

  revalidatePath("/clients");
  return { success: true, data: { id: client.id, name: client.name } };
}

export async function fetchClients(
  params: PaginationParams
): Promise<PaginatedResult<ClientRow>> {
  await getRequiredSession();
  return getClients(params);
}
