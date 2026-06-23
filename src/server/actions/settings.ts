"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { getRequiredSession } from "@/lib/auth/get-session";
import { requireRole } from "@/lib/auth/get-session";
import { getIntercomCaptureRules } from "@/server/queries/settings";
import type { IntercomCaptureRules } from "@/lib/constants/intercom-capture";
import type { ActionResult } from "@/types";

export async function fetchIntercomCaptureRules(): Promise<IntercomCaptureRules> {
  await getRequiredSession();
  return getIntercomCaptureRules();
}

export async function updateSetting(key: string, value: unknown): Promise<ActionResult<void>> {
  await getRequiredSession();
  await requireRole("admin");

  try {
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });

    revalidatePath("/settings");
    revalidatePath("/incidents");
    revalidatePath("/rmas");
    revalidatePath("/dashboard");

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al guardar la configuración" };
  }
}
