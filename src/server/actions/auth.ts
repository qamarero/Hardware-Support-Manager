"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, isNull, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createUserSchema } from "@/lib/validators/user";
import { z } from "zod";
import type { ActionResult } from "@/types";

const registerSchema = createUserSchema.omit({ role: true });

const resetPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
  newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  adminPassword: z.string().min(1, "La contraseña de administrador es obligatoria"),
});

/**
 * Check if any users exist in the database.
 * Used to determine if the setup/register page should be accessible.
 */
export async function checkHasUsers(): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(users)
    .where(isNull(users.deletedAt));
  return result.count > 0;
}

/**
 * Register the first admin user. Only works when no users exist.
 */
export async function registerFirstUser(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  // Check no users exist
  const hasUsers = await checkHasUsers();
  if (hasUsers) {
    return { success: false, error: "Ya existen usuarios registrados. Contacta a un administrador." };
  }

  const parsed = registerSchema.safeParse(input);
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
      role: "admin",
    })
    .returning({ id: users.id });

  return { success: true, data: { id: user.id } };
}

/**
 * Reset a user's password. Requires an admin user's password for verification.
 */
export async function resetPassword(
  input: unknown
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { email, newPassword, adminPassword } = parsed.data;

  // Find the target user
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!targetUser) {
    return { success: false, error: "No se encontró un usuario con ese email" };
  }

  // Find any active admin to verify their password
  const admins = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(10);

  let adminVerified = false;
  for (const admin of admins) {
    if (admin.active) {
      const match = await bcrypt.compare(adminPassword, admin.passwordHash);
      if (match) {
        adminVerified = true;
        break;
      }
    }
  }

  if (!adminVerified) {
    return { success: false, error: "Contraseña de administrador incorrecta" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, targetUser.id));

  return { success: true, data: undefined };
}
