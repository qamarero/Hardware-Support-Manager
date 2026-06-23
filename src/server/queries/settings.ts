import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SLA_THRESHOLDS, type SlaThresholds } from "@/lib/constants/sla";
import { DEFAULT_ALERT_THRESHOLDS, type AlertThresholds } from "@/lib/constants/alerts";
import { DEFAULT_INTERCOM_CAPTURE_RULES, INTERCOM_CAPTURE_RULES_KEY, type IntercomCaptureRules } from "@/lib/constants/intercom-capture";

/**
 * Retrieve a typed setting from the app_settings table.
 *
 * Validates the stored JSONB value against the shape of `defaultValue`:
 * - Every key present in `defaultValue` must exist in the stored value.
 * - Nested objects are checked recursively.
 * - If validation fails, returns `defaultValue` instead of corrupted data.
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (result.length === 0) return defaultValue;

    const stored = result[0].value;

    // Primitive default — trust the DB value type
    if (typeof defaultValue !== "object" || defaultValue === null) {
      return (typeof stored === typeof defaultValue ? stored : defaultValue) as T;
    }

    // Object default — validate that stored value has the same shape
    if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
      return defaultValue;
    }

    if (!hasRequiredKeys(stored as Record<string, unknown>, defaultValue as Record<string, unknown>)) {
      return defaultValue;
    }

    return stored as T;
  } catch {
    return defaultValue;
  }
}

/** Recursively verify that `value` contains all keys from `reference`. */
function hasRequiredKeys(
  value: Record<string, unknown>,
  reference: Record<string, unknown>,
): boolean {
  for (const key of Object.keys(reference)) {
    if (!(key in value)) return false;

    const refVal = reference[key];
    const storedVal = value[key];

    // Check nested objects recursively
    if (
      typeof refVal === "object" &&
      refVal !== null &&
      !Array.isArray(refVal)
    ) {
      if (
        typeof storedVal !== "object" ||
        storedVal === null ||
        Array.isArray(storedVal)
      ) {
        return false;
      }
      if (
        !hasRequiredKeys(
          storedVal as Record<string, unknown>,
          refVal as Record<string, unknown>,
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

export async function getSlaThresholds(): Promise<SlaThresholds> {
  return getSetting("sla_thresholds", DEFAULT_SLA_THRESHOLDS);
}

export async function getAlertThresholds(): Promise<AlertThresholds> {
  return getSetting("alert_thresholds", DEFAULT_ALERT_THRESHOLDS);
}

export async function getDefaultPageSize(): Promise<number> {
  return getSetting("default_page_size", 10);
}

export async function getIntercomCaptureRules(): Promise<IntercomCaptureRules> {
  const r = await getSetting<Partial<IntercomCaptureRules>>(INTERCOM_CAPTURE_RULES_KEY, DEFAULT_INTERCOM_CAPTURE_RULES);
  // Normaliza por si el JSON guardado no trae todas las claves.
  return {
    keywords: r.keywords ?? DEFAULT_INTERCOM_CAPTURE_RULES.keywords,
    ticketTypes: r.ticketTypes ?? [],
    tags: r.tags ?? [],
  };
}

export async function getDefaultView(): Promise<"table" | "canvas"> {
  return getSetting("default_view", "table");
}
