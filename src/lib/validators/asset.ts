import { z } from "zod";

export const createAssetSchema = z.object({
  deviceType: z.string().max(100).optional().or(z.literal("")),
  deviceBrand: z.string().max(255).optional().or(z.literal("")),
  deviceModel: z.string().max(255).optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),
  clientName: z.string().max(500).optional().or(z.literal("")),
  status: z.string().max(40).optional().or(z.literal("")),
  location: z.string().max(255).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  articleId: z.string().uuid("Artículo inválido").optional().or(z.literal("")),
  rmaId: z.string().uuid("RMA inválido").optional().or(z.literal("")),
  incidentId: z.string().uuid("Incidencia inválida").optional().or(z.literal("")),
});

export const updateAssetSchema = createAssetSchema.partial();

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
