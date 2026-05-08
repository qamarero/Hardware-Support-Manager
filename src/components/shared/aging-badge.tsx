import { Badge } from "@/components/ui/badge";
import { Clock, Pause, CheckCircle2 } from "lucide-react";
import { calculateAging, type AgingInput } from "@/lib/utils/aging";

/**
 * Acepta dos formas de uso:
 *
 * - **Simple (legacy)**: solo `stateChangedAt` → cuenta `now - stateChangedAt`.
 *   Compatible con call-sites antiguos que no quieren la lógica freeze/pause.
 *
 * - **Rico**: pasar también `createdAt` + `status` + `resolvedAt` + `slaPausedMs`
 *   y opcionalmente `closedStatuses`/`pausedStatuses` (para RMA, etc.).
 *   Cuando `status` está en `closedStatuses`, el badge se congela en el tiempo
 *   total de vida (createdAt → resolvedAt). Cuando está en `pausedStatuses`,
 *   se congela en el momento de entrar a pausa.
 */
interface AgingBadgeProps {
  stateChangedAt: Date | string | null | undefined;
  thresholdDays?: number;
  createdAt?: Date | string | null;
  status?: string | null;
  resolvedAt?: Date | string | null;
  slaPausedMs?: string | number | null;
  closedStatuses?: readonly string[];
  pausedStatuses?: readonly string[];
}

export function AgingBadge({
  stateChangedAt,
  thresholdDays = 3,
  createdAt,
  status,
  resolvedAt,
  slaPausedMs,
  closedStatuses,
  pausedStatuses,
}: AgingBadgeProps) {
  // Si se pasa contexto rico, usamos la firma rica para que `calculateAging`
  // determine el modo (active/paused/closed). Si no, caemos al modo legacy.
  const richInput: AgingInput | undefined =
    status !== undefined
      ? {
          stateChangedAt,
          createdAt,
          status,
          resolvedAt,
          slaPausedMs,
          closedStatuses,
          pausedStatuses,
        }
      : undefined;

  const aging = calculateAging(richInput ?? stateChangedAt, thresholdDays);

  if (aging.label === "-") return null;

  // Modo CLOSED — congelado, neutro.
  if (aging.mode === "closed") {
    return (
      <Badge
        variant="outline"
        className="gap-1 bg-slate-500/10 text-slate-700 hover:bg-slate-500/10 dark:bg-slate-500/20 dark:text-slate-300"
        title="Tiempo total de vida del caso (cerrado)"
      >
        <CheckCircle2 className="h-3 w-3" />
        {aging.label}
      </Badge>
    );
  }

  // Modo PAUSED — esperando externo, congelado con icono pausa.
  if (aging.mode === "paused") {
    return (
      <Badge
        variant="outline"
        className="gap-1 bg-blue-500/10 text-blue-700 hover:bg-blue-500/10 dark:bg-blue-500/20 dark:text-blue-300"
        title="Tiempo activo congelado — caso en espera de cliente o proveedor"
      >
        <Pause className="h-3 w-3" />
        {aging.label}
      </Badge>
    );
  }

  // Modo ACTIVE — comportamiento original.
  const isCritical = aging.days >= thresholdDays;

  let colorClass: string;
  if (isCritical) {
    colorClass = "bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:bg-red-500/25 dark:text-red-300";
  } else if (aging.days >= 1) {
    colorClass = "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:bg-amber-500/25 dark:text-amber-300";
  } else {
    colorClass = "bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:bg-green-500/25 dark:text-green-300";
  }

  return (
    <Badge variant="outline" className={`gap-1 ${colorClass}${isCritical ? " animate-pulse" : ""}`}>
      <Clock className="h-3 w-3" />
      {aging.label}
    </Badge>
  );
}
