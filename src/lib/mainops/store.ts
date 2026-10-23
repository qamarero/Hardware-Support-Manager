import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { rmas, eventLogs, type RmaPickup } from "@/lib/db/schema";
import { decidePickupUpdate, type PickupDecision } from "./pickup-status";

/**
 * Guarda en el RMA la foto de su recogida que manda MainOps y deja constancia en
 * el historial. Único sitio que escribe `rmas.pickup`: lo usan las acciones del
 * drawer (pedir, anular, sincronizar) y el webhook.
 *
 * No toca el estado del RMA. Lo único que puede rellenar además es
 * «Seguimiento (envío)» con el albarán, y solo si estaba vacío.
 */

/** De dónde viene la foto. Queda en `details.source` del evento. */
export type PickupSource = "solicitud" | "anulacion" | "sincronizacion" | "webhook";

export type ApplyPickupResult =
  | { found: false }
  | {
      found: true;
      applied: false;
      reason: Extract<PickupDecision, { apply: false }>["reason"];
      pickup: RmaPickup | null;
    }
  | { found: true; applied: true; pickup: RmaPickup; trackingFilled: string | null };

export async function applyPickupUpdate(
  rmaId: string,
  incoming: RmaPickup,
  opts: { userId: string | null; source: PickupSource }
): Promise<ApplyPickupResult> {
  if (incoming.rma_id !== rmaId) {
    // MainOps devolvería la recogida de otro RMA: no se guarda en este.
    throw new Error(`La recogida ${incoming.pickup_id} es del RMA ${incoming.rma_id}, no de ${rmaId}`);
  }

  const result = await db.transaction(async (tx): Promise<ApplyPickupResult> => {
    // FOR UPDATE: webhook y botón pueden llegar a la vez; así deciden en fila.
    const [current] = await tx
      .select({ pickup: rmas.pickup, trackingNumberOutgoing: rmas.trackingNumberOutgoing })
      .from(rmas)
      .where(eq(rmas.id, rmaId))
      .for("update")
      .limit(1);
    if (!current) return { found: false };

    const stored = current.pickup ?? null;
    const decision = decidePickupUpdate(stored, incoming, {
      trackingOutgoing: current.trackingNumberOutgoing,
      // Lo que responde MainOps a nuestras llamadas es su recogida vigente; un
      // webhook puede ser de una recogida anterior que llega tarde.
      authoritative: opts.source !== "webhook",
    });
    if (!decision.apply) {
      return { found: true, applied: false, reason: decision.reason, pickup: stored };
    }

    await tx
      .update(rmas)
      .set({
        pickup: incoming,
        ...(decision.fillTracking ? { trackingNumberOutgoing: decision.fillTracking } : {}),
      })
      .where(eq(rmas.id, rmaId));

    if (decision.eventText) {
      await tx.insert(eventLogs).values({
        entityType: "rma",
        entityId: rmaId,
        action: "pickup",
        userId: opts.userId,
        details: {
          comment: decision.eventText,
          pickupId: incoming.pickup_id,
          status: incoming.status,
          source: opts.source,
          ...(decision.fillTracking ? { trackingFilled: decision.fillTracking } : {}),
        },
      });
    }

    return { found: true, applied: true, pickup: incoming, trackingFilled: decision.fillTracking };
  });

  if (result.found && result.applied) {
    revalidatePath("/rmas");
    // Mismas etiquetas que invalidan las acciones de RMA: el feed externo
    // expone el seguimiento, que puede haber cambiado con el albarán.
    revalidateTag("hsm-external-rmas");
    revalidateTag("hsm-external-metrics");
  }
  return result;
}
