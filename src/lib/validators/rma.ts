import { z } from "zod";
import { DEVICE_TYPES } from "@/lib/constants/device-types";

export const createRmaSchema = z.object({
  providerId: z.string().uuid("Proveedor inválido"),
  incidentId: z.string().uuid("Incidencia inválida").optional().or(z.literal("")),
  clientId: z.string().uuid("Cliente inválido").optional().or(z.literal("")),
  deviceType: z.enum(DEVICE_TYPES).optional().or(z.literal("")),
  deviceBrand: z.string().max(255).optional().or(z.literal("")),
  deviceModel: z.string().max(255).optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),
  clientLocal: z.string().max(255).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const updateRmaSchema = z.object({
  providerId: z.string().uuid("Proveedor inválido").optional(),
  incidentId: z.string().uuid("Incidencia inválida").optional().or(z.literal("")),
  clientId: z.string().uuid("Cliente inválido").optional().or(z.literal("")),
  deviceType: z.enum(DEVICE_TYPES).optional().or(z.literal("")),
  deviceBrand: z.string().max(255).optional().or(z.literal("")),
  deviceModel: z.string().max(255).optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),
  clientLocal: z.string().max(255).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  trackingNumberOutgoing: z.string().max(255).optional().or(z.literal("")),
  trackingNumberReturn: z.string().max(255).optional().or(z.literal("")),
  providerRmaNumber: z.string().max(255).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const rmaFormSchema = z.object({
  providerId: z.string().uuid("Proveedor inválido"),
  incidentId: z.string().uuid("Incidencia inválida").optional().or(z.literal("")),
  clientId: z.string().uuid("Cliente inválido").optional().or(z.literal("")),
  deviceType: z.enum(DEVICE_TYPES).optional().or(z.literal("")),
  deviceBrand: z.string().max(255).optional().or(z.literal("")),
  deviceModel: z.string().max(255).optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),
  clientLocal: z.string().max(255).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  trackingNumberOutgoing: z.string().max(255).optional().or(z.literal("")),
  trackingNumberReturn: z.string().max(255).optional().or(z.literal("")),
  providerRmaNumber: z.string().max(255).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const transitionRmaSchema = z.object({
  rmaId: z.string().uuid(),
  toStatus: z.enum([
    "borrador", "solicitado", "aprobado_proveedor", "enviado_proveedor",
    "recibido_proveedor", "en_reparacion_proveedor", "devuelto",
    "recibido_almacen", "cerrado", "cancelado",
  ]),
  comment: z.string().optional(),
});

export type CreateRmaInput = z.infer<typeof createRmaSchema>;
export type UpdateRmaInput = z.infer<typeof updateRmaSchema>;
export type RmaFormInput = z.infer<typeof rmaFormSchema>;
export type TransitionRmaInput = z.infer<typeof transitionRmaSchema>;
