import { NextResponse } from "next/server";
import { requireMainOpsWebhookAuth } from "@/lib/external-auth";
import {
  pickupWebhookSchema,
  PICKUP_WEBHOOK_EVENT,
  UUID_RE,
} from "@/lib/validators/mainops-pickup";
import { applyPickupUpdate } from "@/lib/mainops/store";

/**
 * POST /api/webhooks/mainops/pickups
 *
 * MainOps avisa de cada cambio de estado de una recogida TIPSA pedida desde un
 * RMA: `{ "event": "pickup.status_changed", "pickup": PickupDTO }`.
 * Contrato: docs/connectors/mainops-recogidas-contrato.md §4.
 *
 * - Auth: `X-API-Key` contra `MAINOPS_WEBHOOK_KEY` (503 sin configurar, 401 sin
 *   cabecera, 403 si no coincide).
 * - Idempotente: si ya teníamos ese `status` + `updated_at`, responde 200 sin
 *   tocar nada. MainOps reintenta cada 30 min hasta ver un 2xx, así que un 2xx
 *   significa «procesado» y cualquier otra cosa «vuelve a mandarlo».
 * - 404 si el RMA no existe.
 * - NUNCA cambia el estado del RMA: lo apunta en el historial y, si llega
 *   albarán y «Seguimiento (envío)» está vacío, lo rellena. Avanzar el RMA es
 *   decisión del técnico.
 *
 * Fuera del middleware (su matcher excluye `/api`): la ruta se protege sola.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authError = requireMainOpsWebhookAuth(req);
  if (authError) return authError;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = pickupWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("[MainOps webhook] payload inválido:", parsed.error.issues);
    return NextResponse.json(
      {
        error: "Payload inválido",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }

  const { event, pickup } = parsed.data;

  // Un evento que este HSM no conoce (MainOps más nuevo que nosotros) se acusa
  // con 200 para que no se reintente eternamente; queda en el log.
  if (event !== PICKUP_WEBHOOK_EVENT) {
    console.warn(`[MainOps webhook] evento desconocido «${event}» de ${pickup.pickup_id}: ignorado`);
    return NextResponse.json({ ok: true, ignored: "evento desconocido" });
  }

  // Un id sin forma de UUID no puede ser un RMA nuestro (y Postgres fallaría al
  // compararlo con la columna uuid).
  if (!UUID_RE.test(pickup.rma_id)) {
    return NextResponse.json({ error: "RMA no encontrado" }, { status: 404 });
  }

  try {
    const result = await applyPickupUpdate(pickup.rma_id, pickup, { userId: null, source: "webhook" });
    if (!result.found) {
      return NextResponse.json({ error: "RMA no encontrado" }, { status: 404 });
    }
    if (!result.applied) {
      return NextResponse.json({ ok: true, applied: false, reason: result.reason });
    }
    return NextResponse.json({
      ok: true,
      applied: true,
      ...(result.trackingFilled ? { tracking_filled: result.trackingFilled } : {}),
    });
  } catch (err) {
    // 500: MainOps lo reintentará en la siguiente pasada.
    console.error("[MainOps webhook] error al guardar la recogida:", err);
    return NextResponse.json({ error: "Error interno al procesar el aviso" }, { status: 500 });
  }
}
