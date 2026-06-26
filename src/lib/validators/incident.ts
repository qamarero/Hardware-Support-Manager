import { z } from "zod";

export const createIncidentSchema = z.object({
  clientId: z.string().uuid("Cliente inválido").optional().or(z.literal("")),
  clientLocationId: z.string().uuid("Local inválido").optional().or(z.literal("")),
  clientName: z.string().max(500).optional().or(z.literal("")),
  title: z.string().min(1, "El título es obligatorio").max(500),
  description: z.string().optional().or(z.literal("")),
  category: z.enum(["escalado", "incidencia_directa", "mencion", "otro", "consulta_rapida"]),
  hardwareOrigin: z.enum(["qamarero", "cliente_reciclado"], {
    error: "Indica si el hardware es de Qamarero o reciclado del cliente",
  }),
  priority: z.enum(["baja", "media", "alta", "critica"]),
  slaHours: z.number().int().positive().optional(),
  diagnosis: z.string().optional().or(z.literal("")),
  resolution: z.string().optional().or(z.literal("")),
  assignedUserId: z.string().uuid("Usuario inválido").optional().or(z.literal("")),
  articleId: z.string().uuid("Artículo inválido").optional().or(z.literal("")),
  deviceType: z.string().max(100).optional().or(z.literal("")),
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
    "esperando_proveedor", "esperando_pieza", "resuelto", "cerrado", "cancelado",
  ]),
  comment: z.string().optional(),
  resolutionType: z.enum(["standard", "derivado_rma"]).optional(),
  // Salto libre: cuando es true, se omite la validación del grafo de estados
  // (modelo "estado = situación", no flujo rígido). El resto de efectos
  // (pausa SLA, resolvedAt, log, nota a Intercom) se aplican igual.
  force: z.boolean().optional(),
});

/**
 * Schema for the in-situ quick consultation form.
 *
 * Crea una incidencia ya resuelta (createdAt = resolvedAt = now()) con
 * `category='consulta_rapida'`. La intención es registrar consultas que
 * el técnico atiende en su mesa en pocos minutos sin pasar por el flujo
 * formal de triaje. Permite trackear la "carga oculta" del depto.
 *
 * Solo `title` es obligatorio. El resto opcional para máxima velocidad de
 * captura. Si después la consulta resulta más compleja, puede convertirse
 * a incidencia formal con `convertQuickConsultationSchema`.
 */
export const createQuickConsultationSchema = z.object({
  title: z.string().min(1, "Describe brevemente la consulta").max(500),
  description: z.string().max(5000).optional().or(z.literal("")),
  clientName: z.string().max(255).optional().or(z.literal("")),
  /** Estimación en minutos (0-1440). Permite calcular tiempo invertido total. */
  durationMinutes: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(0, "Mínimo 0 minutos")
    .max(1440, "Máximo 24h (1440 min)")
    .optional(),
});

/**
 * Schema para escalar una consulta rápida a incidencia formal.
 *
 * Cambia category, status y reabre la incidencia (resolvedAt → null).
 * Mantiene `quickDurationMinutes` para preservar el registro inicial.
 */
export const convertQuickConsultationSchema = z.object({
  incidentId: z.string().uuid(),
  toCategory: z.enum(["escalado", "incidencia_directa"]),
  toStatus: z.enum(["nuevo", "en_triaje", "en_gestion"]),
  hardwareOrigin: z.enum(["qamarero", "cliente_reciclado"]),
  priority: z.enum(["baja", "media", "alta", "critica"]),
  comment: z.string().max(2000).optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type TransitionIncidentInput = z.infer<typeof transitionIncidentSchema>;
export type CreateQuickConsultationInput = z.infer<typeof createQuickConsultationSchema>;
export type ConvertQuickConsultationInput = z.infer<typeof convertQuickConsultationSchema>;
