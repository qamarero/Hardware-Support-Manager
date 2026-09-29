"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { findClientByExternalId } from "@/server/actions/support-submissions";

interface Props {
  /** restaurant_id que tecleó quien reportó. */
  externalId: string;
  /** ¿La sumisión ya tiene una ficha de cliente enlazada? */
  yaEnlazado: boolean;
  /** Enlazar la sumisión con la ficha encontrada. Requiere que lo pulse alguien. */
  onEnlazar: (clientId: string, clientName: string) => void;
  enlazando?: boolean;
}

/**
 * Aviso de la bandeja para las sumisiones con restaurante tecleado a mano.
 *
 * El identificador va primero y en grande porque es el dato que se coteja
 * contra la ficha del cliente, y el color adelanta el resultado antes de leer:
 * ámbar si no casa con nada, verde si casa.
 *
 * La comprobación se hace AL ABRIR la sumisión, no cuando se envió. Así, si el
 * restaurante llega más tarde desde CX Advisor —que es lo normal en altas
 * recientes—, aparece solo la próxima vez que se mira, sin tener que acordarse
 * de revisarlo.
 *
 * Nunca enlaza solo: avisa y espera a que una persona lo acepte.
 */
export function ManualClientNotice({ externalId, yaEnlazado, onEnlazar, enlazando }: Props) {
  const { data: ficha, isLoading } = useQuery({
    queryKey: ["client-by-external-id", externalId],
    queryFn: () => findClientByExternalId(externalId),
    staleTime: 0, // se re-comprueba cada vez: el sync corre cada noche
  });

  const casa = !!ficha;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border p-3 ${
          isLoading
            ? "bg-muted/30"
            : casa
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30"
              : "border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30"
        }`}
      >
        <div
          className={`mb-1 text-[10.5px] font-semibold uppercase tracking-wide ${
            isLoading
              ? "text-muted-foreground"
              : casa
                ? "text-emerald-800 dark:text-emerald-300"
                : "text-amber-800 dark:text-amber-300"
          }`}
        >
          ID del restaurante ·{" "}
          {isLoading ? "comprobando…" : casa ? "coincide con una ficha" : "tecleado a mano"}
        </div>
        <div
          className={`break-all font-mono text-[15px] font-semibold leading-snug ${
            isLoading
              ? ""
              : casa
                ? "text-emerald-900 dark:text-emerald-200"
                : "text-amber-900 dark:text-amber-200"
          }`}
        >
          {externalId}
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Buscando ese ID en la base…
        </p>
      ) : casa ? (
        <div className="flex gap-2.5 rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/30">
          <Check className="h-4 w-4 flex-shrink-0 text-emerald-700 dark:text-emerald-500" />
          <div className="flex-1 space-y-2 text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
            <div>
              <strong className="block">
                Ese ID es de «{ficha!.name}»
                {[ficha!.city, ficha!.province].filter(Boolean).length > 0 &&
                  ` (${[ficha!.city, ficha!.province].filter(Boolean).join(", ")})`}
              </strong>
              {yaEnlazado
                ? "La sumisión ya está enlazada con esa ficha."
                : "El ID coincide carácter a carácter. Comprueba que es el local correcto antes de enlazar."}
            </div>
            {!yaEnlazado && (
              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={enlazando}
                onClick={() => onEnlazar(ficha!.id, ficha!.name)}
              >
                {enlazando ? "Enlazando…" : `Enlazar con «${ficha!.name}»`}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-500" />
          <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <strong className="block">Ese ID no aparece en la base</strong>
            O el restaurante aún no ha llegado desde CX Advisor, o el ID está mal
            copiado. Si conviertes ahora, la incidencia nacerá sin cliente
            enlazado. Se vuelve a comprobar cada vez que abras esta sumisión.
          </div>
        </div>
      )}
    </div>
  );
}
