"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAlertCounts } from "@/server/actions/alerts";
import type { AlertBadgeCounts } from "@/server/queries/alerts";

export function useAlertBadges() {
  return useQuery<AlertBadgeCounts>({
    queryKey: ["alert-badges"],
    queryFn: () => fetchAlertCounts(),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}
