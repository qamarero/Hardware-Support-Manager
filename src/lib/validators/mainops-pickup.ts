import { z } from "zod";
import type { RmaPickup } from "@/lib/db/schema/rmas";

/**
 * Validación de lo que llega de MainOps sobre recogidas TIPSA: el PickupDTO del
 * contrato (`docs/connectors/mainops-recogidas-contrato.md`), tanto en las
 * respuestas de su API como en el webhook.
 *
 * Es tolerante a propósito con lo accesorio: un campo que falta o un código que
 * llega como número se normaliza a `null`/texto en vez de tumbar el aviso. Lo
 * que no se negocia es lo que HSM necesita para decidir: `pickup_id`, `rma_id`,
 * `status` (uno de los seis del contrato) y `updated_at`.
 */

export const PICKUP_STATUS_VALUES = [
  "solicitada",
  "programada",
  "incidencia",
  "en_curso",
  "recibida",
  "anulada",
] as const;

/** UUID en forma, sin exigir versión: lo que Postgres acepta en una columna uuid. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto opcional: null si falta, si viene vacío o si es null. Admite número. */
const looseText = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  });

const requiredText = z.union([z.string(), z.number()]).transform((v) => String(v).trim()).pipe(z.string().min(1));

export const pickupDtoSchema = z.object({
  pickup_id: requiredText,
  rma_id: requiredText,
  rma_number: looseText,
  status: z.enum(PICKUP_STATUS_VALUES),
  status_label: looseText,
  pickup_date: looseText,
  time_from: looseText,
  time_to: looseText,
  tipsa_code: looseText,
  albaran: looseText,
  incidence: z
    .object({ code: looseText, label: looseText, observations: looseText })
    .nullish()
    .transform((v) => v ?? null),
  last_event: z
    .object({ code: looseText, label: looseText, date: looseText })
    .nullish()
    .transform((v) => v ?? null),
  cancel_reason: looseText,
  created_at: looseText,
  updated_at: requiredText,
});

// Si el contrato y el tipo guardado en `rmas.pickup` se separan, que falle el build.
type Assert<T extends RmaPickup> = T;
export type ParsedPickupDto = Assert<z.output<typeof pickupDtoSchema>>;

/** Respuesta de `POST …/pickups` y de `POST …/{id}/cancel`. */
export const pickupEnvelopeSchema = z.object({ pickup: pickupDtoSchema });

/** Respuesta de `GET …/pickups?rma_id=`: la más reciente primero. */
export const pickupListSchema = z.object({ pickups: z.array(pickupDtoSchema) });

/** Cuerpo del webhook `POST /api/webhooks/mainops/pickups`. */
export const pickupWebhookSchema = z.object({
  event: z.string().trim().min(1),
  pickup: pickupDtoSchema,
});

export const PICKUP_WEBHOOK_EVENT = "pickup.status_changed";
