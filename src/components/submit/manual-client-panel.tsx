"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { findClientByExternalId } from "@/server/actions/support-submissions";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";

/** Forma de un restaurant_id: 36 caracteres con guiones. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ManualClient {
  name: string;
  externalId: string;
}

interface Props {
  /** Lo ya tecleado en el buscador, para no obligar a escribirlo otra vez. */
  nombreInicial?: string;
  onCancel: () => void;
  /** Se ha aceptado el alta manual: el id NO existe en la base. */
  onConfirm: (cliente: ManualClient) => void;
  /** El id resultó ser de una ficha que ya existe y se ha elegido usarla. */
  onUseExisting: (clientId: string, clientName: string) => void;
}

/**
 * Alta manual de restaurante para cuando no aparece en el buscador.
 *
 * Exige nombre e id: sin el id la anotación no sirve de nada, porque es
 * justamente lo que se coteja después contra la ficha del cliente.
 *
 * No crea ningún cliente. Lo tecleado viaja con la sumisión y lo verifica una
 * persona al revisarla. Si diera de alta la ficha, un acento de más bastaría
 * para duplicar el restaurante.
 */
export function ManualClientPanel({ nombreInicial = "", onCancel, onConfirm, onUseExisting }: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [id, setId] = useState("");
  const [tocado, setTocado] = useState(false);

  const { setInputValue: setIdBuscado, debouncedValue: idBuscado } = useDebouncedSearch(400);

  const formatoOk = UUID_RE.test(id.trim());
  const nombreOk = nombre.trim().length >= 2;

  // En cuanto el id tiene forma válida se mira si ya existe. Lo más probable
  // es que no lo hayan encontrado por el nombre y el restaurante sí esté.
  const { data: yaExiste, isFetching: comprobando } = useQuery({
    queryKey: ["client-by-external-id", idBuscado],
    queryFn: () => findClientByExternalId(idBuscado),
    enabled: UUID_RE.test(idBuscado.trim()),
    staleTime: 60 * 1000,
  });

  function cambiarId(v: string) {
    setId(v);
    setIdBuscado(v);
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-500" />
        <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
          <strong className="block">Solo si de verdad no aparece</strong>
          Prueba antes con una palabra suelta del nombre — «bella» en vez de «La
          Bella Caffé». Si lo metes a mano y ya existía, la incidencia queda
          colgando de un cliente duplicado y hay que rehacerla.
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="manual-nombre" className="text-xs font-semibold">
          Nombre del restaurante *
        </label>
        <input
          id="manual-nombre"
          className="input w-full"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tal como se llama el local"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="manual-id" className="text-xs font-semibold">
          ID del restaurante *
        </label>
        <input
          id="manual-id"
          className="input w-full font-mono text-[12.5px]"
          value={id}
          onChange={(e) => cambiarId(e.target.value)}
          onBlur={() => setTocado(true)}
          placeholder="27673a49-1e4d-4172-a611-5dc27f6906f7"
          autoComplete="off"
          spellCheck={false}
        />
        {tocado && id.trim() && !formatoOk ? (
          <p className="text-[11.5px] text-destructive">
            No parece un ID de restaurante. Son 36 caracteres con guiones, como
            27673a49-1e4d-4172-a611-5dc27f6906f7.
          </p>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">
            Lo tienes en la ficha del cliente del panel interno, bajo el nombre.
          </p>
        )}
      </div>

      {comprobando && formatoOk && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Comprobando si ya está registrado…
        </p>
      )}

      {formatoOk && !comprobando && yaExiste && (
        <div className="flex gap-2.5 rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/30">
          <Check className="h-4 w-4 flex-shrink-0 text-emerald-700 dark:text-emerald-500" />
          <div className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
            <strong className="block">Ese ID ya está registrado: «{yaExiste.name}»</strong>
            {[yaExiste.city, yaExiste.province].filter(Boolean).join(" · ")}
            {yaExiste.province || yaExiste.city ? ". " : ""}
            Mejor enlazar esta ficha: la incidencia queda atada al cliente de verdad.
          </div>
        </div>
      )}

      {formatoOk && !comprobando && yaExiste === null && (
        <div className="flex gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-500" />
          <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <strong className="block">Ese ID no está en la base</strong>
            Se guarda tal cual y no se crea ninguna ficha de cliente. Soporte
            hardware lo comprobará al revisar el reporte.
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn--sm btn--outline" onClick={onCancel}>
          Cancelar
        </button>
        {yaExiste ? (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => onUseExisting(yaExiste.id, yaExiste.name)}
          >
            Usar «{yaExiste.name}»
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={!nombreOk || !formatoOk || comprobando}
            onClick={() => onConfirm({ name: nombre.trim(), externalId: id.trim() })}
          >
            Usar este restaurante
          </button>
        )}
      </div>
    </div>
  );
}
