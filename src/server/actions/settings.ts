"use server";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ActionResult } from "@/types";

export async function updateSetting(key: string, value: unknown): Promise<ActionResult<void>> {
  try {
    const existing = await db
      .select({ id: appSettings.id })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(appSettings)
        .set({ value })
        .where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value });
    }

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al guardar la configuración" };
  }
}
