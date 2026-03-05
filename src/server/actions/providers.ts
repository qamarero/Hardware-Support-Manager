"use server";

import { db } from "@/lib/db";
import { providers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import { createProviderSchema, updateProviderSchema } from "@/lib/validators/provider";
import { getProviders } from "@/server/queries/providers";
import type { ActionResult, PaginationParams, PaginatedResult } from "@/types";
import type { ProviderRow } from "@/server/queries/providers";

export async function createProvider(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();

  const parsed = createProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const [provider] = await db
    .insert(providers)
    .values(parsed.data)
    .returning({ id: providers.id });

  revalidatePath("/providers");
  return { success: true, data: { id: provider.id } };
}

export async function updateProvider(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();

  const parsed = updateProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const [provider] = await db
    .update(providers)
    .set(parsed.data)
    .where(eq(providers.id, id))
    .returning({ id: providers.id });

  if (!provider) {
    return { success: false, error: "Proveedor no encontrado" };
  }

  revalidatePath("/providers");
  revalidatePath(`/providers/${id}`);
  return { success: true, data: { id: provider.id } };
}

export async function deleteProvider(
  id: string
): Promise<ActionResult> {
  await getRequiredSession();

  const [provider] = await db
    .update(providers)
    .set({ deletedAt: new Date() })
    .where(eq(providers.id, id))
    .returning({ id: providers.id });

  if (!provider) {
    return { success: false, error: "Proveedor no encontrado" };
  }

  revalidatePath("/providers");
  return { success: true, data: undefined };
}

export async function fetchProviders(
  params: PaginationParams
): Promise<PaginatedResult<ProviderRow>> {
  await getRequiredSession();
  return getProviders(params);
}
