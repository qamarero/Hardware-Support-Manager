import { z } from "zod";

const rmaBaseFields = {
  providerId: z.string().uuid("Proveedor inválido"),
  incidentId: z.string().uuid("Incidencia inválida").optional().or(z.literal("")),
  clientId: z.string().uuid("Cliente inválido").optional().or(z.literal("")),
  clientName: z.string().max(500).optional().or(z.literal("")),
  clientExternalId: z.string().max(255).optional().or(z.literal("")),
  clientIntercomUrl: z.string().max(1000).optional().or(z.literal("")),
  articleId: z.string().uuid("Artículo inválido").optional().or(z.literal("")),
  deviceType: z.string().max(100).optional().or(z.literal("")),
  deviceBrand: z.string().max(255).optional().or(z.literal("")),
  deviceModel: z.string().max(255).optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),
  contactName: z.string().max(255).optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  pickupAddress: z.string().optional().or(z.literal("")),
  pickupPostalCode: z.string().max(20).optional().or(z.literal("")),
  pickupCity: z.string().max(255).optional().or(z.literal("")),
  trackingNumberOutgoing: z.string().max(255).optional().or(z.literal("")),
  trackingNumberReturn: z.string().max(255).optional().or(z.literal("")),
  providerRmaNumber: z.string().max(255).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  // Granularidad para métricas (A8).
  outcome: z.enum(["reparado", "sustituido", "abono", "rechazado", "sin_solucion", "sustitucion_directa"]).optional().or(z.literal("")),
  logistics: z.enum(["proveedor_gestiona", "nosotros_intermediamos"]).optional().or(z.literal("")),
  repairPath: z.enum(["interna_hwtool", "proveedor"]).optional().or(z.literal("")),
  // Datos de recogida/envío (cliente + destino).
  shipping: z
    .object({
      locationName: z.string().max(255).optional(),
      contactName: z.string().max(255).optional(),
      contactEmail: z.string().max(255).optional(),
      contactPhone: z.string().max(50).optional(),
      address: z.string().optional(),
      postalCode: z.string().max(20).optional(),
      city: z.string().max(255).optional(),
      province: z.string().max(255).optional(),
      reference: z.string().max(500).optional(),
      instructions: z.string().max(2000).optional(),
      destination: z
        .object({
          type: z.enum(["oficina", "sat", "cliente"]).or(z.literal("")).optional(),
          name: z.string().max(255).optional(),
          address: z.string().optional(),
          postalCode: z.string().max(20).optional(),
          city: z.string().max(255).optional(),
          province: z.string().max(255).optional(),
          contact: z.string().max(255).optional(),
          phone: z.string().max(50).optional(),
        })
        .optional(),
    })
    .optional(),
};

export const createRmaSchema = z.object(rmaBaseFields);

export const updateRmaSchema = z.object({
  ...rmaBaseFields,
  providerId: z.string().uuid("Proveedor inválido").optional(),
});

export const rmaFormSchema = z.object(rmaBaseFields);

export const transitionRmaSchema = z.object({
  rmaId: z.string().uuid(),
  toStatus: z.enum([
    "borrador", "solicitado", "aprobado", "enviado_proveedor",
    "en_proveedor", "devuelto", "recibido_oficina", "enviado_cliente",
    "esperando_cliente", "entregado_cliente", "rechazado", "cerrado", "cancelado",
  ]),
  comment: z.string().optional(),
  // Resultado capturado en el cierre (entregado/cerrado/rechazado). Aditivo: se
  // guarda en la misma transición para no dejar la ficha sin resultado.
  outcome: z.enum(["reparado", "sustituido", "abono", "rechazado", "sin_solucion", "sustitucion_directa"]).optional(),
  // Salto libre: omite la validación del grafo (modelo "estado = situación").
  // La pausa de SLA, el auto-cierre de la incidencia y el outcome se aplican igual.
  force: z.boolean().optional(),
});

export type CreateRmaInput = z.infer<typeof createRmaSchema>;
export type UpdateRmaInput = z.infer<typeof updateRmaSchema>;
export type RmaFormInput = z.infer<typeof rmaFormSchema>;
export type TransitionRmaInput = z.infer<typeof transitionRmaSchema>;
