"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAlertCounts } from "@/server/actions/alerts";
import type { AlertBadgeCounts } from "@/server/queries/alerts";

/**
 * Contadores de los badges del nav.
 *
 * `enabled` existe para poder apagarla: un Visor no ve ningún badge (su nav
 * solo tiene Consulta), y las Server Actions de Next van por una cola global
 * de una en una, así que esta llamada retrasaba la de la pantalla que el
 * usuario sí está esperando.
 */
export function useAlertBadges({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<AlertBadgeCounts>({
    queryKey: ["alert-badges"],
    queryFn: () => fetchAlertCounts(),
    refetchInterval: 300_000,
    staleTime: 300_000,
    enabled,
  });
}
