import { z } from "zod";
import { CORK_COLORS } from "@/lib/constants/corcho";

export const createReminderSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(500),
  note: z.string().max(2000).optional().or(z.literal("")),
  // Opcional: una nota del corcho puede no vencer nunca.
  dueAt: z.coerce.date({ message: "Fecha inválida" }).optional().nullable(),
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

/**
 * Nota del corcho. A diferencia de un recordatorio de agenda:
 * `userId` null = para todo el equipo, y `dueAt` null = no vence.
 */
export const corkNoteSchema = z.object({
  title: z.string().trim().min(1, "Escribe algo en la nota").max(500),
  note: z.string().max(2000).optional().or(z.literal("")),
  color: z.enum(CORK_COLORS).default("amarillo"),
  dueAt: z.coerce.date({ message: "Fecha inválida" }).optional().nullable(),
  // null / ausente = nota para todo el equipo.
  userId: z.string().uuid().optional().nullable(),
  entityType: z.enum(["incident", "rma"]).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
}).refine((d) => !d.entityType || !!d.entityId, {
  message: "Falta la incidencia o el RMA a vincular",
  path: ["entityId"],
});

export const updateCorkNoteSchema = z.object({
  id: z.string().uuid(),
}).and(corkNoteSchema);

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type SnoozeReminderInput = z.infer<typeof snoozeReminderSchema>;
export type CorkNoteInput = z.infer<typeof corkNoteSchema>;
