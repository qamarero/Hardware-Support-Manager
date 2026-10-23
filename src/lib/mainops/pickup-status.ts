import type { RmaPickup, RmaPickupStatus } from "@/lib/db/schema/rmas";

/**
 * Estado de la recogida TIPSA de un RMA: etiquetas, textos del historial y la
 * decisión de si un aviso de MainOps cambia algo.
 *
 * Todo puro (sin BD ni red): lo comparten el drawer, las server actions y el
 * webhook, y se prueba en `pickup-status.test.ts`.
 */

/** Mismas etiquetas que el contrato (`status_label`), por si no llega. */
export const PICKUP_STATUS_LABELS: Record<RmaPickupStatus, string> = {
  solicitada: "Solicitada",
  programada: "Programada",
  incidencia: "Incidencia",
  en_curso: "Recogida · en camino",
  recibida: "Recibida",
  anulada: "Anulada",
};

/** Color del badge del prototipo para cada estado. */
export const PICKUP_STATUS_BADGE: Record<RmaPickupStatus, string> = {
  solicitada: "badge--gray",
  programada: "badge--blue",
  incidencia: "badge--amber",
  en_curso: "badge--green",
  recibida: "badge--green",
  anulada: "badge--gray",
};

/**
 * Hay una recogida en marcha (o ya hecha): cualquiera que no esté anulada.
 * Es el mismo criterio de MainOps para no duplicar: mientras haya una así, pedir
 * otra devuelve la misma.
 */
export function isActivePickup(p: RmaPickup | null | undefined): p is RmaPickup {
  return p != null && p.status !== "anulada";
}

/** Desde HSM solo se anula lo que MainOps aún no ha mandado a TIPSA. */
export function canCancelPickup(p: RmaPickup | null | undefined): boolean {
  return p?.status === "solicitada";
}

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** «2026-10-26» → «lun 26/10». Es fecha local de Madrid: no se pasa por zona horaria. */
export function formatPickupDate(date: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? "");
  if (!m) return null;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${WEEKDAYS[day]} ${m[3]}/${m[2]}`;
}

/** «09:00» → «9:00». Si no tiene forma de hora, se devuelve tal cual. */
export function formatPickupTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  return m ? `${Number(m[1])}:${m[2]}` : time;
}

/** «lun 26/10, 9:00–14:00». null si aún no hay fecha. */
export function formatPickupWindow(p: Pick<RmaPickup, "pickup_date" | "time_from" | "time_to">): string | null {
  const date = formatPickupDate(p.pickup_date);
  if (!date) return null;
  const from = formatPickupTime(p.time_from);
  const to = formatPickupTime(p.time_to);
  if (from && to) return `${date}, ${from}–${to}`;
  if (from) return `${date}, desde las ${from}`;
  if (to) return `${date}, hasta las ${to}`;
  return date;
}

/** Etiqueta de la incidencia de TIPSA, con sus observaciones si las hay. */
export function formatPickupIncidence(p: Pick<RmaPickup, "incidence" | "last_event">): string | null {
  const label = p.incidence?.label ?? p.incidence?.code ?? p.last_event?.label ?? null;
  const obs = p.incidence?.observations ?? null;
  if (label && obs) return `${label} (${obs})`;
  return label ?? obs;
}

/**
 * Frase del historial del RMA para el estado en que queda la recogida.
 *
 *   programada → «Recogida programada para lun 26/10, 9:00–14:00 · TIPSA 0028850418»
 *   incidencia → «Incidencia en la recogida: Ausente»
 *   en_curso   → «Recogida realizada · albarán 0000012890»
 *   recibida   → «Recogida recibida en destino»
 *   anulada    → «Recogida anulada: motivo»
 */
export function describePickup(p: RmaPickup): string {
  switch (p.status) {
    case "solicitada":
      return `Recogida solicitada a MainOps · ${p.pickup_id}`;
    case "programada": {
      const when = formatPickupWindow(p);
      return [
        when ? `Recogida programada para ${when}` : "Recogida programada",
        p.tipsa_code ? `TIPSA ${p.tipsa_code}` : null,
      ].filter(Boolean).join(" · ");
    }
    case "incidencia": {
      const what = formatPickupIncidence(p);
      return what ? `Incidencia en la recogida: ${what}` : "Incidencia en la recogida";
    }
    case "en_curso":
      return p.albaran ? `Recogida realizada · albarán ${p.albaran}` : "Recogida realizada";
    case "recibida":
      return "Recogida recibida en destino";
    case "anulada":
      return p.cancel_reason ? `Recogida anulada: ${p.cancel_reason}` : "Recogida anulada";
  }
}

export type PickupDecision =
  | {
      apply: false;
      /**
       * duplicado: ya teníamos ese mismo `status` + `updated_at` (reintento).
       * antiguo: aviso de la misma recogida más viejo que lo guardado (llegó tarde).
       * otra_recogida: aviso de una recogida anterior a la que ya tenemos.
       */
      reason: "duplicado" | "antiguo" | "otra_recogida";
    }
  | {
      apply: true;
      /** Entrada para el historial; null si el cambio no dice nada nuevo. */
      eventText: string | null;
      /** Albarán a copiar en «Seguimiento (envío)», si estaba vacío. */
      fillTracking: string | null;
    };

/** a < b, solo si ambas fechas se entienden. Ante la duda, no se descarta nada. */
function isBefore(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  return Number.isFinite(ta) && Number.isFinite(tb) && ta < tb;
}

/**
 * ¿Qué hacer con una foto nueva de la recogida?
 *
 * - Mismo `pickup_id`, `status` y `updated_at` que lo guardado: se ignora. Es
 *   la idempotencia que pide el contrato (MainOps reintenta hasta ver un 2xx).
 * - Una foto de la misma recogida más vieja que la guardada se ignora siempre:
 *   llegó tarde (un reintento que se cruza con el aviso siguiente, o la
 *   respuesta a un clic que se cruza con un webhook). Nunca se retrocede.
 * - Solo para el webhook (`authoritative: false`): se ignora también el aviso
 *   de una recogida anterior a la guardada. Lo que responde MainOps a nuestras
 *   propias llamadas (pedir, anular, sincronizar) es su recogida vigente y
 *   manda aunque sea otra.
 * - El albarán se copia al seguimiento de salida solo si estaba vacío: lo que
 *   haya escrito una persona no se pisa.
 *
 * Nunca decide nada sobre el estado del RMA: eso es cosa del técnico.
 */
export function decidePickupUpdate(
  stored: RmaPickup | null | undefined,
  incoming: RmaPickup,
  opts: { trackingOutgoing?: string | null; authoritative?: boolean } = {}
): PickupDecision {
  const samePickup = stored != null && stored.pickup_id === incoming.pickup_id;

  if (samePickup && stored.status === incoming.status && stored.updated_at === incoming.updated_at) {
    return { apply: false, reason: "duplicado" };
  }
  if (samePickup && isBefore(incoming.updated_at, stored.updated_at)) {
    return { apply: false, reason: "antiguo" };
  }
  if (!opts.authoritative && stored && !samePickup && isBefore(incoming.created_at, stored.created_at)) {
    return { apply: false, reason: "otra_recogida" };
  }

  const fillTracking =
    incoming.albaran && !(opts.trackingOutgoing ?? "").trim() ? incoming.albaran : null;

  const text = describePickup(incoming);
  const previous = samePickup ? describePickup(stored) : null;
  let eventText: string | null = text !== previous ? text : null;
  if (fillTracking) eventText = `${text} · copiado a «Seguimiento (envío)»`;

  return { apply: true, eventText, fillTracking };
}
