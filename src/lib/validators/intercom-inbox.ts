import { z } from "zod";

export const convertToIncidentSchema = z.object({
  inboxItemId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional().or(z.literal("")),
  category: z.enum(["escalado", "incidencia_directa", "mencion", "otro"]),
  hardwareOrigin: z.enum(["qamarero", "cliente_reciclado"], {
    error: "Indica el origen del hardware",
  }),
  priority: z.enum(["baja", "media", "alta", "critica"]).default("media"),
  clientId: z.string().uuid("Cliente inválido").optional().or(z.literal("")),
  clientName: z.string().max(500).optional().or(z.literal("")),
  articleId: z.string().uuid("Artículo inválido").optional().or(z.literal("")),
  deviceType: z.string().optional().or(z.literal("")),
  deviceBrand: z.string().optional().or(z.literal("")),
  deviceModel: z.string().optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),
  contactName: z.string().optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  pickupAddress: z.string().optional().or(z.literal("")),
  pickupCity: z.string().max(255).optional().or(z.literal("")),
  pickupPostalCode: z.string().max(20).optional().or(z.literal("")),
});

export type ConvertToIncidentInput = z.infer<typeof convertToIncidentSchema>;

export const dismissInboxItemSchema = z.object({
  inboxItemId: z.string().uuid(),
});
