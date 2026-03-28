import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1, "El nombre de empresa es obligatorio").max(500),
  externalId: z.string().max(255).optional().or(z.literal("")),
  intercomUrl: z.string().max(1000).optional().or(z.literal("")),
  email: z.string().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  contactName: z.string().max(255).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().max(255).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const updateClientSchema = createClientSchema.partial().required({ name: true });

export const createClientLocationSchema = z.object({
  clientId: z.string().uuid("Cliente inválido"),
  name: z.string().min(1, "El nombre del local es obligatorio").max(255),
  contactName: z.string().max(255).optional().or(z.literal("")),
  contactEmail: z.string().email("Email inválido").max(255).optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().max(255).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

export const updateClientLocationSchema = createClientLocationSchema.partial().omit({ clientId: true }).required({ name: true });

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateClientLocationInput = z.infer<typeof createClientLocationSchema>;
export type UpdateClientLocationInput = z.infer<typeof updateClientLocationSchema>;
