"use client";

import { createContext, useContext, useState } from "react";
import { IncidentDetailDrawer } from "@/components/incidents-v2/incident-detail-drawer";
import { RmaDetailDrawer } from "@/components/rmas-v2/rma-detail-drawer";

interface DrawersContextValue {
  openIncident: (id: string) => void;
  openRma: (id: string) => void;
  /** Abre la entidad a partir de una ruta tipo /incidents/<id> o /rmas/<id>. */
  openByUrl: (url: string) => void;
}

const DrawersContext = createContext<DrawersContextValue | null>(null);

export function useDrawers(): DrawersContextValue {
  const ctx = useContext(DrawersContext);
  if (!ctx) throw new Error("useDrawers debe usarse dentro de <DrawersProvider>");
  return ctx;
}

/**
 * Provee drawers de detalle (incidencia/RMA) a nivel de app, para abrirlos
 * desde cualquier sitio (buscador global, centro de avisos…) sin navegar a
 * las páginas antiguas. Mantiene la experiencia en la ficha lateral nueva.
 */
export function DrawersProvider({ children }: { children: React.ReactNode }) {
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [rmaId, setRmaId] = useState<string | null>(null);

  const openByUrl = (url: string) => {
    const incMatch = url.match(/\/incidents\/([0-9a-f-]+)/i);
    if (incMatch) { setIncidentId(incMatch[1]); return; }
    const rmaMatch = url.match(/\/rmas\/([0-9a-f-]+)/i);
    if (rmaMatch) { setRmaId(rmaMatch[1]); return; }
  };

  return (
    <DrawersContext.Provider value={{ openIncident: setIncidentId, openRma: setRmaId, openByUrl }}>
      {children}
      <IncidentDetailDrawer incidentId={incidentId} onClose={() => setIncidentId(null)} />
      <RmaDetailDrawer rmaId={rmaId} onClose={() => setRmaId(null)} />
    </DrawersContext.Provider>
  );
}
