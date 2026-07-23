"use server";

import { db } from "@/lib/db";
import { assets, assetEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import { createAssetSchema, updateAssetSchema } from "@/lib/validators/asset";
import { generateSequentialId } from "@/lib/utils/id-generator";
import { getAssets, getAssetById, getAssetEvents, type AssetRow, type AssetEventRow } from "@/server/queries/assets";
import type { ActionResult } from "@/types";

export async function deleteAsset(id: string): Promise<ActionResult<{ id: string }>> {
  await getRequiredSession();
  const [row] = await db.delete(assets).where(eq(assets.id, id)).returning({ id: assets.id });
  if (!row) return { success: false, error: "Equipo no encontrado" };
  revalidatePath("/equipos");
  return { success: true, data: { id: row.id } };
}

export async function fetchAssets(): Promise<AssetRow[]> {
  await getRequiredSession();
  try {
    return await getAssets();
  } catch {
    // Tolerante: si la migración sql/020 (tabla hsm.assets) aún no se aplicó,
    // mostramos la lista vacía en vez de romper la página.
    return [];
  }
}

export async function fetchAssetById(id: string): Promise<AssetRow | null> {
  await getRequiredSession();
  return getAssetById(id);
}

export async function fetchAssetEvents(id: string): Promise<AssetEventRow[]> {
  await getRequiredSession();
  try {
    return await getAssetEvents(id);
  } catch {
    return [];
  }
}

export async function createAsset(
  input: unknown
): Promise<ActionResult<{ id: string; assetCode: string }>> {
  const session = await getRequiredSession();
  const parsed = createAssetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const d = parsed.data;
  const assetCode = await generateSequentialId("EQ");
  const status = d.status || "disponible";

  const [asset] = await db
    .insert(assets)
    .values({
      assetCode,
      deviceType: d.deviceType || null,
      deviceBrand: d.deviceBrand || null,
      deviceModel: d.deviceModel || null,
      deviceSerialNumber: d.deviceSerialNumber || null,
      clientName: d.clientName || null,
      status,
      location: d.location || null,
      notes: d.notes || null,
      reconditioned: d.reconditioned ?? false,
      articleId: d.articleId || null,
      rmaId: d.rmaId || null,
      incidentId: d.incidentId || null,
    })
    .returning({ id: assets.id });

  await db.insert(assetEvents).values({
    assetId: asset.id,
    action: "created",
    toStatus: status,
    clientName: status === "en_cliente" ? d.clientName || null : null,
    userId: session.user.id,
  });

  revalidatePath("/equipos");
  return { success: true, data: { id: asset.id, assetCode } };
}

export async function updateAsset(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getRequiredSession();
  const parsed = updateAssetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const d = parsed.data;
  const values: Record<string, unknown> = {};
  if (d.deviceType !== undefined) values.deviceType = d.deviceType || null;
  if (d.deviceBrand !== undefined) values.deviceBrand = d.deviceBrand || null;
  if (d.deviceModel !== undefined) values.deviceModel = d.deviceModel || null;
  if (d.deviceSerialNumber !== undefined) values.deviceSerialNumber = d.deviceSerialNumber || null;
  if (d.clientName !== undefined) values.clientName = d.clientName || null;
  if (d.status !== undefined && d.status) values.status = d.status;
  if (d.location !== undefined) values.location = d.location || null;
  if (d.notes !== undefined) values.notes = d.notes || null;
  if (d.reconditioned !== undefined) values.reconditioned = d.reconditioned;
  if (d.articleId !== undefined) values.articleId = d.articleId || null;
  if (d.rmaId !== undefined) values.rmaId = d.rmaId || null;
  if (d.incidentId !== undefined) values.incidentId = d.incidentId || null;

  const [old] = await db
    .select({ status: assets.status, clientName: assets.clientName })
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);

  const [asset] = await db
    .update(assets)
    .set(values)
    .where(eq(assets.id, id))
    .returning({ id: assets.id });

  if (!asset) return { success: false, error: "Equipo no encontrado" };

  // Historial: registrar cambio de situación / asignación a cliente.
  if (old) {
    const newStatus = (values.status as string | undefined) ?? old.status;
    const newClient =
      values.clientName !== undefined ? (values.clientName as string | null) : old.clientName;
    if (newStatus !== old.status) {
      const action =
        newStatus === "en_cliente"
          ? "assigned"
          : old.status === "en_cliente"
            ? "returned"
            : "status_change";
      await db.insert(assetEvents).values({
        assetId: id,
        action,
        fromStatus: old.status,
        toStatus: newStatus,
        clientName: newStatus === "en_cliente" ? newClient : null,
        userId: session.user.id,
      });
    } else if (
      newStatus === "en_cliente" &&
      values.clientName !== undefined &&
      (values.clientName ?? null) !== (old.clientName ?? null)
    ) {
      await db.insert(assetEvents).values({
        assetId: id,
        action: "assigned",
        fromStatus: old.status,
        toStatus: newStatus,
        clientName: newClient,
        userId: session.user.id,
      });
    }
  }

  revalidatePath("/equipos");
  revalidatePath(`/equipos/${id}`);
  return { success: true, data: { id: asset.id } };
}
