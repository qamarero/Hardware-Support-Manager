export const ENTITY_TYPES = {
  INCIDENT: "incident",
  RMA: "rma",
  EVENT_LOG: "event_log",
  CLIENT: "client",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — PDFs de fabricante de RMA suelen ser grandes.

export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;
