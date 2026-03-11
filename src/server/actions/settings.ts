"use server";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/get-session";
import { requireRole } from "@/lib/auth/get-session";
import type { ActionResult } from "@/types";

export async function updateSetting(key: string, value: unknown): Promise<ActionResult<void>> {
  await getRequiredSession();
  await requireRole("admin");

  try {
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value },
      });

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al guardar la configuración" };
  }
}
