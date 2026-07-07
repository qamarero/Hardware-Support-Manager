"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Marca personal de "revisada hoy" para la ronda de seguimiento diario.
 *
 * Vive en localStorage con clave por usuario + fecha
 * (`hsm:reviewed:{userId}:{YYYY-MM-DD}`), así se resetea sola cada día sin
 * tocar la BD ni ensuciar el timeline. Es una marca personal (no compartida);
 * el registro auditable de "contacté al cliente" va aparte en event_logs.
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
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "anon";
  // `day` se fija en cliente (evita desajuste SSR/CSR); vacío hasta montar.
  const [day, setDay] = useState("");
  const [ids, setIds] = useState<Set<string>>(new Set());

  const storageKey = day ? `hsm:reviewed:${userId}:${day}` : "";

  // Carga inicial + recarga al volver a la pestaña (por si cambió el día).
  useEffect(() => {
    function load() {
      const d = todayStr();
      const key = `hsm:reviewed:${userId}:${d}`;
      setDay(d);
      try {
        const raw = localStorage.getItem(key);
        setIds(new Set(raw ? (JSON.parse(raw) as string[]) : []));
      } catch {
        setIds(new Set());
      }
    }
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [userId]);

  const persist = useCallback(
    (next: Set<string>) => {
      setIds(new Set(next));
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* cuota/privado */ }
      }
    },
    [storageKey],
  );

  const isReviewed = useCallback((key: string) => ids.has(key), [ids]);
  const markReviewed = useCallback((key: string) => { const n = new Set(ids); n.add(key); persist(n); }, [ids, persist]);
  const unmark = useCallback((key: string) => { const n = new Set(ids); n.delete(key); persist(n); }, [ids, persist]);

  return { ready: !!day, isReviewed, markReviewed, unmark, reviewedCount: ids.size };
}
