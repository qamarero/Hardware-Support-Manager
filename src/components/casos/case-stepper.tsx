import { Check } from "lucide-react";

/**
 * Stepper combinado incidencia↔RMA. Mapea los estados reales a un pipeline
 * unificado de 7 etapas, calculando la etapa actual.
 */
const STAGES = [
  "Abierta",
  "En curso",
  "RMA solicitado",
  "Aprobado",
  "En proveedor",
  "Recibido",
  "Cerrada",
] as const;

function currentStageIndex(incidentStatus: string, rmaStatus: string | null): number {
  // Cerrada/resuelta gana siempre.
  if (["resuelto", "cerrado", "cancelado"].includes(incidentStatus)) return 6;

  if (rmaStatus) {
    switch (rmaStatus) {
      case "borrador":
      case "solicitado":
        return 2;
      case "aprobado":
        return 3;
      case "enviado_proveedor":
      case "en_proveedor":
        return 4;
      case "devuelto":
      case "recibido_oficina":
        return 5;
      case "cerrado":
        return 6;
      case "cancelado":
        return 2;
    }
  }

  // Sin RMA: por estado de incidencia.
  if (incidentStatus === "en_gestion" || incidentStatus === "esperando_pieza" || incidentStatus === "esperando_proveedor" || incidentStatus === "esperando_cliente") {
    return 1;
  }
  return 0; // nuevo / en_triaje → Abierta
}

export function CaseStepper({
  incidentStatus,
  rmaStatus,
}: {
  incidentStatus: string;
  rmaStatus: string | null;
}) {
  const current = currentStageIndex(incidentStatus, rmaStatus);

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {STAGES.map((stage, i) => {
        const done = i < current;
        const active = i === current;
        // Etapas de RMA que no aplican si no hay RMA: las atenuamos.
        const isRmaStage = i >= 2 && i <= 5;
        const dim = isRmaStage && !rmaStatus && !done && !active;
        return (
          <div key={stage} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary/15 text-primary"
                    : dim
                      ? "text-muted-foreground/40"
                      : "text-muted-foreground"
              }`}
            >
              {done && <Check className="h-3 w-3" />}
              {stage}
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-px w-3 ${i < current ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
