import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const createUserSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(255),
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(["admin", "technician", "viewer"]),
  avatarUrl: z.string().url("URL inválida").max(500).optional().or(z.literal("")),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(255).optional(),
  email: z.string().email("Email inválido").max(255).optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  role: z.enum(["admin", "technician", "viewer"]).optional(),
  active: z.boolean().optional(),
  avatarUrl: z.string().url("URL inválida").max(500).optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
