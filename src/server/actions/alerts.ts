"use server";

import { getRequiredSession } from "@/lib/auth/get-session";
import { getAlertCounts, getAlertItems } from "@/server/queries/alerts";
import type { AlertBadgeCounts, AlertSummary } from "@/server/queries/alerts";

export async function fetchAlertCounts(): Promise<AlertBadgeCounts> {
  await getRequiredSession();
  return getAlertCounts();
}

export async function fetchAlertItems(): Promise<AlertSummary> {
  await getRequiredSession();
  return getAlertItems();
}
