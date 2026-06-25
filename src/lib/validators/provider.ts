import { z } from "zod";

export const providerContactSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(255),
  email: z.string().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  role: z.string().max(100).optional().or(z.literal("")),
});

export const providerRmaProcessSchema = z.object({
  method: z.enum(["email", "portal", "portal_y_email"]).or(z.literal("")).optional(),
  emailTo: z.string().max(500).optional().or(z.literal("")),
  emailCc: z.string().max(500).optional().or(z.literal("")),
  requiresForm: z.boolean().optional(),
  formType: z.enum(["web", "pdf"]).or(z.literal("")).optional(),
  formUrl: z.string().max(500).optional().or(z.literal("")),
  allowsDirectToClient: z.boolean().optional(),
  steps: z.string().max(5000).optional().or(z.literal("")),
});

export const createProviderSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(255),
  email: z.string().email("Email inválido").max(255).optional().or(z.literal("")),
  website: z.string().max(500).optional().or(z.literal("")),
  rmaUrl: z.string().max(500).optional().or(z.literal("")),
  contacts: z.array(providerContactSchema).optional(),
  notes: z.string().optional().or(z.literal("")),
  rmaProcess: providerRmaProcessSchema.optional(),
});

export const updateProviderSchema = createProviderSchema.partial().required({ name: true });

export type ProviderContactInput = z.infer<typeof providerContactSchema>;
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
