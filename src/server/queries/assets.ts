import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
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
