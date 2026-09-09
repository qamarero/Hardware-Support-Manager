/**
 * Notas del corcho. Una nota es un recordatorio (`hsm.reminders`) con
 * `kind = "nota"`: puede no tener fecha y puede no tener dueño.
 * Ver sql/028-corcho-notas.sql.
 */

export const REMINDER_KINDS = ["nota", "seguimiento"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const CORK_COLORS = [
  "amarillo",
  "rosa",
  "verde",
  "azul",
  "naranja",
  "morado",
] as const;
export type CorkColor = (typeof CORK_COLORS)[number];

export const DEFAULT_CORK_COLOR: CorkColor = "amarillo";

export const CORK_COLOR_LABELS: Record<CorkColor, string> = {
  amarillo: "Amarillo",
  rosa: "Rosa",
  verde: "Verde",
  azul: "Azul",
  naranja: "Naranja",
  morado: "Morado",
};

/** Papel del post-it: fondo, borde del degradado y color de la tinta. */
export const CORK_COLOR_PAPER: Record<CorkColor, { bg: string; edge: string; ink: string }> = {
  amarillo: { bg: "#fff79a", edge: "#fff04d", ink: "#6b5e00" },
  rosa: { bg: "#ffd4cc", edge: "#ffb8aa", ink: "#8a1c00" },
  verde: { bg: "#d7f0d2", edge: "#bce4b4", ink: "#1f5a17" },
  azul: { bg: "#cfe6ff", edge: "#aed3fb", ink: "#0f3f70" },
  naranja: { bg: "#ffe7b3", edge: "#ffd98a", ink: "#7a4e00" },
  morado: { bg: "#e6d9f7", edge: "#d2bef0", ink: "#4a2a7a" },
};

export function corkPaper(color: string) {
  return CORK_COLOR_PAPER[color as CorkColor] ?? CORK_COLOR_PAPER[DEFAULT_CORK_COLOR];
}

/** Etiqueta del destinatario de una nota. */
export function corkAudienceLabel(assignedName: string | null): string {
  return assignedName ?? "Para todo el equipo";
}
