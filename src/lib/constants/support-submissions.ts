export const SUPPORT_SUBMISSION_STATUSES = {
  PENDIENTE: "pendiente",
  CONVERTIDA: "convertida",
  DESCARTADA: "descartada",
} as const;

export type SupportSubmissionStatus =
  (typeof SUPPORT_SUBMISSION_STATUSES)[keyof typeof SUPPORT_SUBMISSION_STATUSES];

export const SUPPORT_SUBMISSION_STATUS_LABELS: Record<SupportSubmissionStatus, string> = {
  pendiente: "Pendiente",
  convertida: "Convertida",
  descartada: "Descartada",
};

/** Allowed email domains for submitters */
export const ALLOWED_SUBMITTER_DOMAINS = ["qamarero.com", "qami.es"];

/** Max submissions per IP per window */
export const RATE_LIMIT_MAX_REQUESTS = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/** Adjuntos del formulario público: solo imágenes y límite más conservador
 *  que el interno (la subida es sin login). */
export const SUBMIT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export const SUBMIT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const SUBMIT_MAX_ATTACHMENTS = 10;
