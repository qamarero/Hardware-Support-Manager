import { z } from "zod";

export const createClientSchema = z.object({
  clientCode: z.string().max(50).optional().or(z.literal("")),
  name: z.string().min(1, "El nombre es obligatorio").max(255),
  email: z.string().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  company: z.string().max(255).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  clientPnp: z.boolean().optional(),
  notes: z.string().optional().or(z.literal("")),
});

export const updateClientSchema = createClientSchema.partial().required({ name: true });

export const quickCreateClientSchema = z.object({
  clientCode: z.string().min(1, "El ID de cliente es obligatorio").max(50),
  name: z.string().min(1, "El nombre es obligatorio").max(255),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type QuickCreateClientInput = z.infer<typeof quickCreateClientSchema>;
