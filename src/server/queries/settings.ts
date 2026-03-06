import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SLA_THRESHOLDS, type SlaThresholds } from "@/lib/constants/sla";

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (result.length === 0) return defaultValue;
    return result[0].value as T;
  } catch {
    return defaultValue;
  }
}

export async function getSlaThresholds(): Promise<SlaThresholds> {
  return getSetting("sla_thresholds", DEFAULT_SLA_THRESHOLDS);
}

export async function getDefaultPageSize(): Promise<number> {
  return getSetting("default_page_size", 10);
}

export async function getDefaultView(): Promise<"table" | "canvas"> {
  return getSetting("default_view", "table");
}
