import { z } from "zod";
import { DEVICE_TYPES } from "@/lib/constants/device-types";

export const createIncidentSchema = z.object({
  clientId: z.string().uuid("Cliente inválido").optional().or(z.literal("")),
  clientLocationId: z.string().uuid("Local inválido").optional().or(z.literal("")),
  clientName: z.string().max(500).optional().or(z.literal("")),
  title: z.string().min(1, "El título es obligatorio").max(500),
  description: z.string().optional().or(z.literal("")),
  category: z.enum(["hardware", "periferico", "red", "almacenamiento", "impresora", "monitor", "otro"]),
  priority: z.enum(["baja", "media", "alta", "critica"]),
  assignedUserId: z.string().uuid("Usuario inválido").optional().or(z.literal("")),
  deviceType: z.enum(DEVICE_TYPES).optional().or(z.literal("")),
  deviceBrand: z.string().max(255).optional().or(z.literal("")),
  deviceModel: z.string().max(255).optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),
  intercomUrl: z.string().max(1000).optional().or(z.literal("")),
  intercomEscalationId: z.string().max(255).optional().or(z.literal("")),
  contactName: z.string().max(255).optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  pickupAddress: z.string().optional().or(z.literal("")),
  pickupPostalCode: z.string().max(20).optional().or(z.literal("")),
  pickupCity: z.string().max(255).optional().or(z.literal("")),
});

export const updateIncidentSchema = createIncidentSchema.partial();

export const transitionIncidentSchema = z.object({
  incidentId: z.string().uuid(),
  toStatus: z.enum([
    "nuevo", "en_triaje", "en_gestion", "esperando_cliente",
    "esperando_proveedor", "resuelto", "cerrado", "cancelado",
  ]),
  comment: z.string().optional(),
  resolutionType: z.enum(["standard", "derivado_rma"]).optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type TransitionIncidentInput = z.infer<typeof transitionIncidentSchema>;
