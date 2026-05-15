import { z } from "zod";

export const addNoteSchema = z.object({
  entityType: z.enum(["incident", "rma"]),
  entityId: z.string().uuid(),
  body: z.string().min(1, "La nota no puede estar vacía").max(2000, "La nota es demasiado larga (máx. 2000 caracteres)"),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;
