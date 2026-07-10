/**
 * Utilidades de periodos de fecha (semana ISO + periodo anterior equivalente).
 * Trabajan en UTC con strings YYYY-MM-DD para evitar saltos de DST y encajar
 * con las queries de HSM (que consumen strings, no Date).
 */

export interface Periods {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

/** Suma (o resta) días a un YYYY-MM-DD y devuelve YYYY-MM-DD. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Hoy en YYYY-MM-DD (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Lunes (inicio) de la semana ISO que contiene `iso`. */
export function isoWeekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=domingo … 6=sábado
  const diff = day === 0 ? -6 : 1 - day; // mover a lunes
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Rango lunes→domingo de la semana que empieza en `weekStartIso`. */
export function weekRange(weekStartIso: string): { from: string; to: string } {
  return { from: weekStartIso, to: addDaysIso(weekStartIso, 6) };
}

/**
 * Periodo anterior equivalente (mismo número de días justo antes de `from`).
 * Mismo cálculo que usa `/api/external/metrics`.
 */
export function computePeriods(fromIso: string, toIso: string): Periods {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));

  return {
    from: fromIso,
    to: toIso,
    prevFrom: prevFrom.toISOString().slice(0, 10),
    prevTo: prevTo.toISOString().slice(0, 10),
  };
}

/** Rango de la semana actual (lunes→domingo) + la anterior, listo para KPIs. */
export function currentWeekPeriods(refIso: string = todayIso()): Periods {
  const start = isoWeekStart(refIso);
  const { from, to } = weekRange(start);
  return computePeriods(from, to);
}
