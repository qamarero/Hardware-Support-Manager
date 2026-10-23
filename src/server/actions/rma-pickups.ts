"use server";

import { z } from "zod";
import { requireWriteAccess } from "@/lib/auth/get-session";
import { getRmaById } from "@/server/queries/rmas";
import { RMA_LOGISTICS, RMA_LOGISTICS_LABELS } from "@/lib/constants/rmas";
import { UUID_RE } from "@/lib/validators/mainops-pickup";
import {
  MainOpsError,
  MAINOPS_CANCEL_CONFLICT,
  requestPickup,
  cancelPickup,
  getPickups,
} from "@/lib/mainops/client";
import { applyPickupUpdate } from "@/lib/mainops/store";
import { isActivePickup } from "@/lib/mainops/pickup-status";
import type { RmaPickup } from "@/lib/db/schema";
import type { ActionResult } from "@/types";

/**
 * Recogidas TIPSA del RMA pedidas a MainOps (botones del bloque «Recogida» del
 * drawer). Cada acción guarda en `rmas.pickup` lo que devuelve MainOps y deja
 * una entrada en el historial del RMA. Ninguna cambia el estado del RMA.
 *
 * Contrato: docs/connectors/mainops-recogidas-contrato.md
 */

const rmaIdSchema = z.string().regex(UUID_RE, "RMA inválido");
const reasonSchema = z.string().trim().max(500).optional();

function toError(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof MainOpsError) return { success: false, error: err.message };
  console.error(`[MainOps] ${fallback}:`, err);
  return { success: false, error: fallback };
}

/** Trae de MainOps la recogida más reciente del RMA y la guarda. Best-effort. */
async function resyncQuietly(rmaId: string, userId: string): Promise<void> {
  try {
    const [latest] = await getPickups(rmaId);
    if (latest) await applyPickupUpdate(rmaId, latest, { userId, source: "sincronizacion" });
  } catch (err) {
    console.error("[MainOps] resincronización tras error falló:", err);
  }
}

/** «Pedir recogida a MainOps». */
export async function requestRmaPickup(
  rmaId: string
): Promise<ActionResult<{ pickup: RmaPickup; created: boolean }>> {
  const session = await requireWriteAccess();

  const id = rmaIdSchema.safeParse(rmaId);
  if (!id.success) return { success: false, error: "RMA inválido" };

  try {
    const rma = await getRmaById(id.data);
    if (!rma) return { success: false, error: "RMA no encontrado" };

    if (rma.logistics !== RMA_LOGISTICS.NOSOTROS_INTERMEDIAMOS) {
      return {
        success: false,
        error: `La recogida solo se pide a MainOps cuando la logística es «${RMA_LOGISTICS_LABELS.nosotros_intermediamos}»`,
      };
    }
    if (isActivePickup(rma.pickup)) {
      return {
        success: false,
        error: `Este RMA ya tiene una recogida en marcha (${rma.pickup.pickup_id}). Sincroniza si no ves su último estado`,
      };
    }

    const { pickup, created } = await requestPickup(rma, {
      name: session.user.name,
      email: session.user.email,
    });
    await applyPickupUpdate(rma.id, pickup, { userId: session.user.id, source: "solicitud" });
    return { success: true, data: { pickup, created } };
  } catch (err) {
    return toError(err, "No se pudo pedir la recogida");
  }
}

/** «Anular»: solo mientras MainOps no la ha mandado a TIPSA (`solicitada`). */
export async function cancelRmaPickup(
  rmaId: string,
  reason?: string
): Promise<ActionResult<{ pickup: RmaPickup }>> {
  const session = await requireWriteAccess();

  const id = rmaIdSchema.safeParse(rmaId);
  const motivo = reasonSchema.safeParse(reason);
  if (!id.success) return { success: false, error: "RMA inválido" };
  if (!motivo.success) return { success: false, error: "El motivo no puede pasar de 500 caracteres" };

  try {
    const rma = await getRmaById(id.data);
    if (!rma) return { success: false, error: "RMA no encontrado" };

    const stored = rma.pickup ?? null;
    if (!stored) return { success: false, error: "Este RMA no tiene ninguna recogida pedida" };
    if (stored.status === "anulada") return { success: false, error: "La recogida ya está anulada" };
    if (stored.status !== "solicitada") return { success: false, error: MAINOPS_CANCEL_CONFLICT };

    let pickup: RmaPickup;
    try {
      pickup = await cancelPickup(stored.pickup_id, motivo.data);
    } catch (err) {
      // 409: en MainOps ya va más avanzada de lo que creíamos (se perdió un
      // aviso). Se trae su estado real para que la ficha deje de ofrecer «Anular».
      if (err instanceof MainOpsError && err.status === 409) await resyncQuietly(rma.id, session.user.id);
      throw err;
    }

    await applyPickupUpdate(rma.id, pickup, { userId: session.user.id, source: "anulacion" });
    return { success: true, data: { pickup } };
  } catch (err) {
    return toError(err, "No se pudo anular la recogida");
  }
}

/**
 * «Sincronizar»: por si se perdió un webhook. Toma la recogida más reciente que
 * tenga MainOps para el RMA. `found` = false si MainOps no tiene ninguna.
 */
export async function syncRmaPickup(
  rmaId: string
): Promise<ActionResult<{ pickup: RmaPickup | null; changed: boolean; found: boolean }>> {
  const session = await requireWriteAccess();

  const id = rmaIdSchema.safeParse(rmaId);
  if (!id.success) return { success: false, error: "RMA inválido" };

  try {
    const rma = await getRmaById(id.data);
    if (!rma) return { success: false, error: "RMA no encontrado" };

    const pickups = await getPickups(rma.id);
    const latest = pickups.find((p) => p.rma_id === rma.id) ?? null;
    if (!latest) return { success: true, data: { pickup: rma.pickup ?? null, changed: false, found: false } };

    const res = await applyPickupUpdate(rma.id, latest, { userId: session.user.id, source: "sincronizacion" });
    if (!res.found) return { success: false, error: "RMA no encontrado" };
    return { success: true, data: { pickup: latest, changed: res.applied, found: true } };
  } catch (err) {
    return toError(err, "No se pudo sincronizar la recogida");
  }
}
