"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTodayReviews, markReviewed as markAction, unmarkReviewed as unmarkAction } from "@/server/actions/daily-reviews";

/**
 * Marca "revisada hoy" de la ronda diaria, **compartida por el equipo** y
 * persistida en BD (tabla `hsm.daily_reviews`, ver sql/022). Si un técnico
 * marca una incidencia/RMA como revisada hoy, desaparece de la ronda de todos.
 * Se resetea solo cada día (la fecha es la local del cliente). Se refresca cada
 * minuto para ver lo que marcan los compañeros. API idéntica a la versión local
 * anterior: isReviewed / markReviewed / unmark / reviewedCount / ready.
 */

export type ReviewKey = `incident:${string}` | `rma:${string}`;

export function reviewKey(type: "incident" | "rma", id: string): ReviewKey {
  return `${type}:${id}` as ReviewKey;
}

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useDailyReview() {
  const qc = useQueryClient();
  const [day, setDay] = useState("");

  // La fecha "hoy" se fija en cliente (evita desajuste SSR) y se revisa al
  // volver a la pestaña (por si cambió el día).
  useEffect(() => {
    setDay(todayStr());
    const onVis = () => { if (document.visibilityState === "visible") setDay(todayStr()); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const qkey = ["daily-reviews", day] as const;

  const { data: ids = new Set<string>() } = useQuery({
    queryKey: qkey,
    enabled: !!day,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const rows = await fetchTodayReviews(day);
      return new Set(rows.map((r) => `${r.entityType}:${r.entityId}`));
    },
  });

  const patchLocal = useCallback(
    (fn: (s: Set<string>) => void) => {
      qc.setQueryData<Set<string>>(qkey, (prev) => { const n = new Set(prev ?? []); fn(n); return n; });
    },
    [qc, day], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const markM = useMutation({
    mutationFn: (key: string) => { const [t, id] = key.split(":"); return markAction({ entityType: t, entityId: id, date: day }); },
    onMutate: (key: string) => patchLocal((s) => s.add(key)),
    onError: (_e, key) => patchLocal((s) => { s.delete(key); }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["daily-reviews"] }),
  });
  const unmarkM = useMutation({
    mutationFn: (key: string) => { const [t, id] = key.split(":"); return unmarkAction({ entityType: t, entityId: id, date: day }); },
    onMutate: (key: string) => patchLocal((s) => { s.delete(key); }),
    onError: (_e, key) => patchLocal((s) => s.add(key)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["daily-reviews"] }),
  });

  const isReviewed = useCallback((k: string) => ids.has(k), [ids]);
  const markReviewed = useCallback((k: string) => { if (day) markM.mutate(k); }, [day, markM]);
  const unmark = useCallback((k: string) => { if (day) unmarkM.mutate(k); }, [day, unmarkM]);

  return { ready: !!day, isReviewed, markReviewed, unmark, reviewedCount: ids.size };
}
