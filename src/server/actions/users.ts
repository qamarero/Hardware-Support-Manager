"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/get-session";
import { createUserSchema, updateUserSchema } from "@/lib/validators/user";
import { getUsers } from "@/server/queries/users";
import type { ActionResult, PaginationParams, PaginatedResult } from "@/types";
import type { UserRow } from "@/server/queries/users";

export async function createUser(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireRole("admin");

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  // Check duplicate email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (existing) {
    return { success: false, error: "Ya existe un usuario con ese email" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const [user] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    })
    .returning({ id: users.id });

  revalidatePath("/users");
  return { success: true, data: { id: user.id } };
}

export async function updateUser(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole("admin");

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  // Prevent self-removal of admin role
  if (session.user.id === id && parsed.data.role && parsed.data.role !== "admin") {
    return { success: false, error: "No puedes cambiar tu propio rol de administrador" };
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  // Hash password only if provided
  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }
  delete updateData.password;

  const [user] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!user) {
    return { success: false, error: "Usuario no encontrado" };
  }

  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  return { success: true, data: { id: user.id } };
}

export async function deleteUser(
  id: string
): Promise<ActionResult> {
  const session = await requireRole("admin");

  // Prevent self-deletion
  if (session.user.id === id) {
    return { success: false, error: "No puedes eliminarte a ti mismo" };
  }

  const [user] = await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!user) {
    return { success: false, error: "Usuario no encontrado" };
  }

  revalidatePath("/users");
  return { success: true, data: undefined };
}

export async function fetchUsers(
  params: PaginationParams
): Promise<PaginatedResult<UserRow>> {
  await requireRole("admin");
  return getUsers(params);
}
