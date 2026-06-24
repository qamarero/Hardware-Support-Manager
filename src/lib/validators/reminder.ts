import { z } from "zod";

export const createReminderSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(500),
  note: z.string().max(2000).optional().or(z.literal("")),
  dueAt: z.coerce.date({ message: "Fecha inválida" }),
  entityType: z.enum(["incident", "rma"]).optional(),
  entityId: z.string().uuid().optional(),
  // Dueño; si no se pasa, se asigna al usuario de la sesión.
  userId: z.string().uuid().optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
});

export const reassignReminderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export const snoozeReminderSchema = z.object({
  id: z.string().uuid(),
  dueAt: z.coerce.date({ message: "Fecha inválida" }),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type SnoozeReminderInput = z.infer<typeof snoozeReminderSchema>;
