import {
  CLOSED_INCIDENT_STATUSES,
  PAUSED_INCIDENT_STATES,
} from "@/lib/constants/statuses";

export type AgingMode = "active" | "paused" | "closed";

export interface AgingResult {
  days: number;
  hours: number;
  minutes: number;
  label: string;
  isOverdue: boolean;
  /**
   * Modo del cálculo:
   * - "active":  cuenta `now - stateChangedAt` (caso normal en proceso).
   * - "paused":  congelado en el momento de entrar al estado pausado, descontando pausas previas.
   * - "closed":  congelado en `resolvedAt ?? stateChangedAt`, descontando pausas.
   */
  mode: AgingMode;
}

export interface AgingInput {
  /** Fecha de creación del registro. Necesaria para `closed` y `paused` (descuenta pausas). */
  createdAt?: Date | string | null;
  /** Fecha del último cambio de estado. Siempre necesaria. */
  stateChangedAt: Date | string | null | undefined;
  /** Estado actual. Si no se pasa, cae al modo "active" legacy. */
  status?: string | null;
  /** Fecha de resolución (incidencias resueltas). Para "closed" si está. */
  resolvedAt?: Date | string | null;
  /** Tiempo en pausa acumulado en milisegundos (varchar en BD para incidencias). */
  slaPausedMs?: string | number | null;
  /** Estados que congelan el badge ("recibido_oficina"/"cerrado"/"cancelado" para RMA). */
  closedStatuses?: readonly string[];
  /** Estados que pausan el badge (por defecto los de incidencias). */
  pausedStatuses?: readonly string[];
}

/**
 * Convierte cualquiera de los formatos aceptados a Date.
 * Devuelve null si la entrada es null/undefined.
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return typeof value === "string" ? new Date(value) : value;
}

/**
 * `slaPausedMs` viene como string varchar(50) desde la BD para incidencias.
 * Para RMA se pasa null. Devuelve 0 si no es número válido.
 */
function parsePausedMs(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildLabel(diffMs: number): {
  days: number;
  hours: number;
  minutes: number;
  label: string;
} {
  // Defensivo: si el cálculo da negativo (datos inconsistentes) lo tratamos como 0.
  const safeMs = Math.max(0, diffMs);
  const totalMinutes = Math.floor(safeMs / (1000 * 60));
  const totalHours = Math.floor(safeMs / (1000 * 60 * 60));
  const totalDays = Math.floor(safeMs / (1000 * 60 * 60 * 24));

  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  let label: string;
  if (totalDays > 0) {
    label = `${totalDays}d ${hours}h`;
  } else if (totalHours > 0) {
    label = `${totalHours}h ${minutes}m`;
  } else {
    label = `${minutes}m`;
  }

  return { days: totalDays, hours, minutes, label };
}

/**
 * Calcula la antigüedad de una entidad (incidencia o RMA) según su estado.
 *
 * Soporta dos firmas:
 *
 * 1) **Legacy** — pasar solo `stateChangedAt` (Date | string | null). Calcula
 *    `now - stateChangedAt` y devuelve `mode: 'active'`. Mantiene compatibilidad
 *    con tests antiguos y call-sites que aún no pasan contexto rico.
 *
 * 2) **Rico** — pasar el objeto `AgingInput`. Determina el `mode`:
 *    - `closed`  si `status ∈ closedStatuses`. Congela en `resolvedAt ?? stateChangedAt`,
 *                 descuenta `slaPausedMs`. Cuenta desde `createdAt` (vida total).
 *    - `paused`  si `status ∈ pausedStatuses`. Congela en `stateChangedAt`,
 *                 descuenta `slaPausedMs`. Cuenta desde `createdAt`.
 *    - `active`  cualquier otro caso.
 *
 * thresholdDays solo aplica al modo `active` (los cerrados/pausados no son "overdue").
 */
export function calculateAging(
  input: AgingInput | Date | string | null | undefined,
  thresholdDays: number = 3,
): AgingResult {
  // Firma legacy: solo stateChangedAt.
  if (
    input == null ||
    input instanceof Date ||
    typeof input === "string"
  ) {
    return calculateActive(toDate(input as Date | string | null | undefined), thresholdDays);
  }

  const {
    createdAt: createdAtRaw,
    stateChangedAt: stateChangedAtRaw,
    status,
    resolvedAt: resolvedAtRaw,
    slaPausedMs,
    closedStatuses = CLOSED_INCIDENT_STATUSES,
    pausedStatuses = PAUSED_INCIDENT_STATES,
  } = input;

  const stateChangedAt = toDate(stateChangedAtRaw);
  const createdAt = toDate(createdAtRaw);
  const resolvedAt = toDate(resolvedAtRaw);
  const pausedMs = parsePausedMs(slaPausedMs);

  // CLOSED: congelado total de vida del caso.
  if (status && (closedStatuses as readonly string[]).includes(status)) {
    const reference = resolvedAt ?? stateChangedAt;
    if (!reference || !createdAt) {
      return calculateActive(stateChangedAt, thresholdDays, "closed");
    }
    const diffMs = reference.getTime() - createdAt.getTime() - pausedMs;
    const parts = buildLabel(diffMs);
    return { ...parts, isOverdue: false, mode: "closed" };
  }

  // PAUSED: congelado en el momento de entrar al estado pausado.
  if (status && (pausedStatuses as readonly string[]).includes(status)) {
    if (!stateChangedAt || !createdAt) {
      return calculateActive(stateChangedAt, thresholdDays, "paused");
    }
    const diffMs = stateChangedAt.getTime() - createdAt.getTime() - pausedMs;
    const parts = buildLabel(diffMs);
    return { ...parts, isOverdue: false, mode: "paused" };
  }

  // ACTIVE: comportamiento clásico.
  return calculateActive(stateChangedAt, thresholdDays);
}

/**
 * Cálculo legacy: now - stateChangedAt. Usado tanto para la firma antigua
 * (test legacy y call-sites simples) como para el modo "active" del
 * comportamiento rico.
 *
 * `forcedMode` permite respetar el modo aunque falten datos para el cálculo
 * rico (fallback seguro).
 */
function calculateActive(
  stateChangedAt: Date | null,
  thresholdDays: number,
  forcedMode: AgingMode = "active",
): AgingResult {
  if (!stateChangedAt) {
    return { days: 0, hours: 0, minutes: 0, label: "-", isOverdue: false, mode: forcedMode };
  }

  const diffMs = Date.now() - stateChangedAt.getTime();
  const parts = buildLabel(diffMs);

  return {
    ...parts,
    isOverdue: forcedMode === "active" && parts.days >= thresholdDays,
    mode: forcedMode,
  };
}
