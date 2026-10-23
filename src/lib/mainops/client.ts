import type { RmaPickup } from "@/lib/db/schema/rmas";
import { pickupEnvelopeSchema, pickupListSchema } from "@/lib/validators/mainops-pickup";
import { buildPickupRequest, type PickupRmaInput, type PickupRequester } from "./pickup-request";

/**
 * Cliente de la API de recogidas de MainOps (solo servidor).
 *
 * MainOps es quien habla con TIPSA; HSM solo pide, anula y consulta. Auth con
 * `X-API-Key: MAINOPS_API_KEY` contra `MAINOPS_BASE_URL`. Contrato:
 * docs/connectors/mainops-recogidas-contrato.md §1-3.
 *
 * Los fallos salen como `MainOpsError` con un mensaje en español listo para el
 * toast; el detalle técnico va a la consola del servidor.
 */

export type MainOpsOperation = "solicitar" | "anular" | "consultar";

export class MainOpsError extends Error {
  constructor(
    message: string,
    /** HTTP de MainOps; null si no hubo respuesta (sin configurar, red, timeout). */
    readonly status: number | null
  ) {
    super(message);
    this.name = "MainOpsError";
  }
}

export const MAINOPS_NOT_CONFIGURED = "MainOps no está configurado";
export const MAINOPS_CANCEL_CONFLICT = "Ya está programada: pide a logística que la anule desde MainOps";

/** TIPSA va por SOAP detrás de MainOps; 15 s sobran para una petición normal. */
const TIMEOUT_MS = 15_000;

/** Campos del cuerpo (`field` de un 400) en palabras del técnico. */
const FIELD_LABELS: Record<string, string> = {
  rma_id: "id del RMA",
  rma_number: "nº de RMA",
  "origin.name": "nombre del local",
  "origin.contact_name": "persona de contacto",
  "origin.phone": "teléfono de recogida",
  "origin.email": "email de recogida",
  "origin.address": "dirección de recogida",
  "origin.postal_code": "código postal de recogida",
  "origin.city": "ciudad de recogida",
  "origin.province": "provincia de recogida",
  "destination.type": "destino del envío",
  "destination.name": "nombre del destino",
  "destination.contact_name": "contacto del destino",
  "destination.phone": "teléfono del destino",
  "destination.address": "dirección del destino",
  "destination.postal_code": "código postal del destino",
  "destination.city": "ciudad del destino",
  items: "equipo a recoger",
  instructions: "instrucciones para el mensajero",
  packages: "bultos",
  weight_kg: "peso",
  requested_by: "solicitante",
  reason: "motivo",
};

/** «origin.postal_code» → «código postal de recogida»; «items.0.serial» → «equipo a recoger». */
export function describeMainOpsField(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const parts = field.split(/[.[\]]+/).filter(Boolean);
  for (let i = parts.length - 1; i > 0; i--) {
    const prefix = parts.slice(0, i).join(".");
    if (FIELD_LABELS[prefix]) return FIELD_LABELS[prefix];
  }
  return field;
}

/** Mensaje para el técnico a partir de la respuesta de error de MainOps. */
export function mainOpsErrorMessage(op: MainOpsOperation, status: number, body: unknown): string {
  const b = body && typeof body === "object" ? (body as { error?: unknown; field?: unknown }) : {};
  const detail = typeof b.error === "string" ? b.error.trim() : "";
  const field = typeof b.field === "string" ? b.field.trim() : "";

  if (status === 400) {
    if (field) return `MainOps rechaza el dato «${describeMainOpsField(field)}»${detail ? `: ${detail}` : ""}`;
    return `MainOps rechaza la petición${detail ? `: ${detail}` : ""}`;
  }
  if (status === 401 || status === 403) {
    return "MainOps no acepta la clave de HSM: revisa MAINOPS_API_KEY";
  }
  if (status === 404) {
    return op === "anular" ? "MainOps no encuentra esa recogida" : "MainOps no encuentra lo que se le pide";
  }
  if (status === 409 && op === "anular") return MAINOPS_CANCEL_CONFLICT;
  if (status === 503) return MAINOPS_NOT_CONFIGURED;
  return `MainOps ha fallado (error ${status}). Prueba de nuevo en un rato`;
}

function getConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.MAINOPS_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.MAINOPS_API_KEY?.trim();
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

export function isMainOpsConfigured(): boolean {
  return getConfig() !== null;
}

async function mainOpsFetch(
  op: MainOpsOperation,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<{ status: number; body: unknown }> {
  const cfg = getConfig();
  if (!cfg) throw new MainOpsError(MAINOPS_NOT_CONFIGURED, null);

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method: init.method,
      headers: {
        "X-API-Key": cfg.apiKey,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[MainOps] ${op} ${path}: sin respuesta`, err);
    throw new MainOpsError("No se pudo contactar con MainOps. Prueba de nuevo en un momento", null);
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`[MainOps] ${op} ${path}: HTTP ${res.status}`, body);
    throw new MainOpsError(mainOpsErrorMessage(op, res.status, body), res.status);
  }
  return { status: res.status, body };
}

function unexpected(op: MainOpsOperation, body: unknown, issues: unknown): MainOpsError {
  console.error(`[MainOps] ${op}: respuesta con forma inesperada`, issues, body);
  return new MainOpsError("MainOps ha respondido algo que HSM no entiende", null);
}

/**
 * Pide la recogida del RMA. `created` = false cuando MainOps ya tenía una activa
 * para ese RMA (200) y devuelve esa misma: un doble clic no duplica.
 */
export async function requestPickup(
  rma: PickupRmaInput,
  requestedBy?: PickupRequester | null
): Promise<{ pickup: RmaPickup; created: boolean }> {
  const built = buildPickupRequest(rma, requestedBy);
  if (!built.ok) throw new MainOpsError(built.error, null);

  const res = await mainOpsFetch("solicitar", "/api/external/hsm/pickups", {
    method: "POST",
    body: built.body,
  });
  const parsed = pickupEnvelopeSchema.safeParse(res.body);
  if (!parsed.success) throw unexpected("solicitar", res.body, parsed.error.issues);
  return { pickup: parsed.data.pickup, created: res.status === 201 };
}

/** Anula una solicitud. Solo vale mientras está `solicitada` (si no, 409). */
export async function cancelPickup(pickupId: string, reason?: string | null): Promise<RmaPickup> {
  const motivo = reason?.trim();
  const res = await mainOpsFetch("anular", `/api/external/hsm/pickups/${encodeURIComponent(pickupId)}/cancel`, {
    method: "POST",
    body: motivo ? { reason: motivo } : {},
  });
  const parsed = pickupEnvelopeSchema.safeParse(res.body);
  if (!parsed.success) throw unexpected("anular", res.body, parsed.error.issues);
  return parsed.data.pickup;
}

/** Recogidas del RMA en MainOps, la más reciente primero (incluidas anuladas). */
export async function getPickups(rmaId: string): Promise<RmaPickup[]> {
  const res = await mainOpsFetch("consultar", `/api/external/hsm/pickups?rma_id=${encodeURIComponent(rmaId)}`, {
    method: "GET",
  });
  const parsed = pickupListSchema.safeParse(res.body);
  if (!parsed.success) throw unexpected("consultar", res.body, parsed.error.issues);
  return parsed.data.pickups;
}
