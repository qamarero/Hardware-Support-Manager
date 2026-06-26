import { z } from "zod";
import { ALLOWED_SUBMITTER_DOMAINS, SUBMIT_MAX_ATTACHMENTS } from "@/lib/constants/support-submissions";

const emailDomainRegex = new RegExp(
  `@(${ALLOWED_SUBMITTER_DOMAINS.join("|").replace(/\./g, "\\.")})$`,
  "i"
);

export const createSubmissionSchema = z.object({
  // Submitter
  submitterName: z.string().min(2, "Nombre demasiado corto").max(255),
  submitterEmail: z
    .string()
    .email("Email no válido")
    .max(500)
    .refine(
      (email) => emailDomainRegex.test(email),
      `Solo se permiten emails de: ${ALLOWED_SUBMITTER_DOMAINS.join(", ")}`
    ),

  // Client
  clientName: z.string().min(2, "Nombre de cliente requerido").max(500),

  // Incident
  title: z.string().min(3, "Título demasiado corto").max(120),
  description: z.string().min(10, "Descripción demasiado corta").max(5000),
  priority: z.enum(["baja", "media", "alta", "critica"]),

  // Device (optional)
  deviceType: z.string().max(100).optional().or(z.literal("")),
  deviceBrand: z.string().max(255).optional().or(z.literal("")),
  deviceModel: z.string().max(255).optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),

  // Contact (optional)
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  // Opcional: el técnico puede añadir la URL de Intercom a posteriori.
  intercomUrl: z
    .string()
    .max(1000)
    .refine(
      (val) => !val || val.startsWith("http"),
      "Debe ser una URL válida (https://app.intercom.com/...)"
    )
    .optional()
    .or(z.literal("")),

  // Adjuntos (imágenes) subidos desde el formulario público.
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        name: z.string().max(255),
        size: z.number().int().nonnegative(),
        type: z.string().max(100),
      })
    )
    .max(SUBMIT_MAX_ATTACHMENTS)
    .optional(),

  // Honeypot field — must be empty (bots fill it)
  website: z.string().max(0, "").optional().or(z.literal("")),
});

export const dismissSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export const convertSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  // Override fields if reviewer edited them
  title: z.string().min(3).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(["baja", "media", "alta", "critica"]).optional(),
  // Channel-based categorization (since commit 9f6ffc1).
  // Submissions from CX team are always "escalado" by default (they're
  // escalating from another team), but reviewer can override.
  category: z.enum([
    "escalado", "incidencia_directa", "mencion", "otro",
  ]).default("escalado"),
  // Hardware origin is required when creating incidents (since commit a98abd6).
  hardwareOrigin: z.enum(["qamarero", "cliente_reciclado"], {
    error: "Indica si el hardware es de Qamarero o reciclado del cliente",
  }),
  clientId: z.string().uuid().optional().or(z.literal("")),
  deviceType: z.string().max(100).optional().or(z.literal("")),
  deviceBrand: z.string().max(255).optional().or(z.literal("")),
  deviceModel: z.string().max(255).optional().or(z.literal("")),
  deviceSerialNumber: z.string().max(255).optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  intercomUrl: z.string().max(1000).optional().or(z.literal("")),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type DismissSubmissionInput = z.infer<typeof dismissSubmissionSchema>;
export type ConvertSubmissionInput = z.infer<typeof convertSubmissionSchema>;
