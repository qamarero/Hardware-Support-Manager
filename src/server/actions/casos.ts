"use server";

import { getRequiredSession } from "@/lib/auth/get-session";
import { getCasos, type CasoFilter, type CasoRow } from "@/server/queries/casos";

export async function fetchCasos(filter: CasoFilter = "activos"): Promise<CasoRow[]> {
  await getRequiredSession();
  return getCasos(filter);
}
