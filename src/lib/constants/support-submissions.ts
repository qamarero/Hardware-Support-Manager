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
