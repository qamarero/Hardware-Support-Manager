"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useQueryState, parseAsStringEnum } from "nuqs";
import { Loader2, RotateCcw, ArrowRight, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { IncidentStateBadge } from "@/components/shared/state-badge";
import { CaseStepper } from "./case-stepper";
import { fetchCasos } from "@/server/actions/casos";
import type { CasoFilter } from "@/server/queries/casos";
import type { IncidentStatus } from "@/lib/constants/incidents";

const FILTERS: { value: CasoFilter; label: string }[] = [
  { value: "activos", label: "Activos" },
  { value: "con_rma", label: "Con RMA" },
  { value: "sin_rma", label: "Sin RMA" },
  { value: "todos", label: "Todos" },
];

export function CasosContent() {
  const [filter, setFilter] = useQueryState(
    "filtro",
    parseAsStringEnum<CasoFilter>(["activos", "con_rma", "sin_rma", "todos"]).withDefault("activos")
  );

  const { data: casos = [], isLoading } = useQuery({
    queryKey: ["casos", filter],
    queryFn: () => fetchCasos(filter),
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.value
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando casos…
        </div>
      ) : casos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Layers className="h-8 w-8" />
          <p className="text-sm">Sin casos para este filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {casos.map((c) => {
            // Banner "Cerrar incidencia": RMA ya de vuelta y la incidencia sigue esperando pieza.
            const rmaBack = c.rma && ["devuelto", "recibido_oficina", "cerrado"].includes(c.rma.status);
            const incidentWaiting = c.status === "esperando_pieza";
            const showCloseBanner = rmaBack && incidentWaiting;

            return (
              <Card key={c.incidentId}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/incidents/${c.incidentId}`}
                          className="font-mono text-sm font-semibold text-primary hover:underline"
                        >
                          {c.incidentNumber}
                        </Link>
                        <IncidentStateBadge status={c.status as IncidentStatus} />
                        {c.rma && (
                          <Link
                            href={`/rmas/${c.rma.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground hover:bg-muted/70"
                          >
                            <ArrowRight className="h-3 w-3" /> {c.rma.rmaNumber}
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{c.title}</p>
                      {c.clientName && (
                        <p className="text-xs text-muted-foreground">{c.clientName}</p>
                      )}
                    </div>
                  </div>

                  <CaseStepper incidentStatus={c.status} rmaStatus={c.rma?.status ?? null} />

                  {showCloseBanner && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
                      <span className="text-green-700 dark:text-green-300">
                        El RMA ya está de vuelta — la incidencia puede cerrarse.
                      </span>
                      <Link
                        href={`/incidents/${c.incidentId}`}
                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        Abrir incidencia <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}

                  {!c.rma && !["resuelto", "cerrado", "cancelado"].includes(c.status) && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RotateCcw className="h-3 w-3" />
                      Sin RMA — derívalo desde la ficha de la incidencia si procede.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
