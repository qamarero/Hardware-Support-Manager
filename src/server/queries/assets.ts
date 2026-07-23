import { db } from "@/lib/db";
import { assets, assetEvents, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export type AssetRow = typeof assets.$inferSelect;

/** Lista de equipos físicos (pocos registros → sin paginación). */
export async function getAssets(): Promise<AssetRow[]> {
  return db.select().from(assets).orderBy(desc(assets.createdAt));
}

export async function getAssetById(id: string): Promise<AssetRow | null> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return asset ?? null;
}

export interface AssetEventRow {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  clientName: string | null;
  note: string | null;
  userName: string | null;
  createdAt: Date;
}

/** Historial (seguimiento individual) de un equipo, más reciente primero. */
export async function getAssetEvents(assetId: string): Promise<AssetEventRow[]> {
  return db
    .select({
      id: assetEvents.id,
      action: assetEvents.action,
      fromStatus: assetEvents.fromStatus,
      toStatus: assetEvents.toStatus,
      clientName: assetEvents.clientName,
      note: assetEvents.note,
      userName: users.name,
      createdAt: assetEvents.createdAt,
    })
    .from(assetEvents)
    .leftJoin(users, eq(assetEvents.userId, users.id))
    .where(eq(assetEvents.assetId, assetId))
    .orderBy(desc(assetEvents.createdAt));
}
