"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CorkBoard, type BoardColumn, type PostItData, type SlaLevel } from "./cork-board";
import { isValidTransition } from "@/lib/state-machines/incident";
import { isValidRmaTransition } from "@/lib/state-machines/rma";
import { transitionIncident } from "@/server/actions/incidents";
import { transitionRma } from "@/server/actions/rmas";
import {
  INCIDENT_STATUS_LABELS,
  type IncidentStatus,
  type IncidentPriority,
} from "@/lib/constants/incidents";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import { PAUSED_INCIDENT_STATES, PAUSED_RMA_STATES } from "@/lib/constants/statuses";
import { DEFAULT_SLA_THRESHOLDS } from "@/lib/constants/sla";
import type { IncidentRow } from "@/server/queries/incidents";
import type { RmaRow } from "@/server/queries/rmas";

const INCIDENT_COLUMNS: BoardColumn[] = [
  { id: "nuevo", label: INCIDENT_STATUS_LABELS.nuevo },
  { id: "en_triaje", label: INCIDENT_STATUS_LABELS.en_triaje },
  { id: "en_gestion", label: INCIDENT_STATUS_LABELS.en_gestion },
  { id: "esperando_cliente", label: INCIDENT_STATUS_LABELS.esperando_cliente, paused: true },
  { id: "esperando_proveedor", label: INCIDENT_STATUS_LABELS.esperando_proveedor, paused: true },
  { id: "esperando_pieza", label: INCIDENT_STATUS_LABELS.esperando_pieza, paused: true },
  { id: "resuelto", label: INCIDENT_STATUS_LABELS.resuelto },
];

const RMA_COLUMNS: BoardColumn[] = [
  { id: "borrador", label: RMA_STATUS_LABELS.borrador },
  { id: "solicitado", label: RMA_STATUS_LABELS.solicitado },
  { id: "aprobado", label: RMA_STATUS_LABELS.aprobado },
  { id: "enviado_proveedor", label: RMA_STATUS_LABELS.enviado_proveedor, paused: true },
  { id: "en_proveedor", label: RMA_STATUS_LABELS.en_proveedor, paused: true },
  { id: "devuelto", label: RMA_STATUS_LABELS.devuelto },
  { id: "recibido_oficina", label: RMA_STATUS_LABELS.recibido_oficina },
];

function incidentSla(inc: IncidentRow): SlaLevel {
  if ((PAUSED_INCIDENT_STATES as readonly string[]).includes(inc.status)) return "paused";
  const slaHours = DEFAULT_SLA_THRESHOLDS.resolution[inc.priority as IncidentPriority] ?? 168;
  const elapsed = (Date.now() - new Date(inc.createdAt).getTime()) / 3_600_000;
  if (elapsed > slaHours) return "overdue";
  if (elapsed > slaHours * 0.75) return "warn";
  return "ok";
}

function rmaSla(rma: RmaRow): SlaLevel {
  if ((PAUSED_RMA_STATES as readonly string[]).includes(rma.status)) return "paused";
  const days = (Date.now() - new Date(rma.stateChangedAt).getTime()) / 86_400_000;
  if (days > 14) return "overdue";
  if (days > 7) return "warn";
  return "ok";
}

interface TableroContentProps {
  incidents: IncidentRow[];
  rmas: RmaRow[];
}

export function TableroContent({ incidents, rmas }: TableroContentProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"incidencias" | "rmas">("incidencias");

  const incidentMove = useMutation({
    mutationFn: (v: { id: string; to: string }) =>
      transitionIncident({ incidentId: v.id, toStatus: v.to }),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Estado actualizado");
      router.refresh();
    },
    onError: () => toast.error("Error al cambiar estado"),
  });

  const rmaMove = useMutation({
    mutationFn: (v: { id: string; to: string }) =>
      transitionRma({ rmaId: v.id, toStatus: v.to }),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Estado actualizado");
      router.refresh();
    },
    onError: () => toast.error("Error al cambiar estado"),
  });

  const incidentCards: PostItData[] = incidents.map((inc) => ({
    id: inc.id,
    ref: inc.incidentNumber,
    href: `/incidents/${inc.id}`,
    title: inc.title,
    status: inc.status,
    meta: inc.clientCompanyName ?? inc.clientName ?? undefined,
    slaLevel: incidentSla(inc),
  }));

  const rmaCards: PostItData[] = rmas.map((rma) => ({
    id: rma.id,
    ref: rma.rmaNumber,
    href: `/rmas/${rma.id}`,
    title: [rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" ") || rma.rmaNumber,
    status: rma.status,
    meta: rma.providerName ?? undefined,
    slaLevel: rmaSla(rma),
  }));

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border p-0.5">
        {(["incidencias", "rmas"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "incidencias" ? "Incidencias" : "RMAs"}
          </button>
        ))}
      </div>

      {tab === "incidencias" ? (
        <CorkBoard
          columns={INCIDENT_COLUMNS}
          cards={incidentCards}
          canMove={(from, to) => isValidTransition(from as IncidentStatus, to as IncidentStatus, "admin")}
          onMove={(id, _from, to) => incidentMove.mutate({ id, to })}
        />
      ) : (
        <CorkBoard
          columns={RMA_COLUMNS}
          cards={rmaCards}
          canMove={(from, to) => isValidRmaTransition(from as RmaStatus, to as RmaStatus, "admin")}
          onMove={(id, _from, to) => rmaMove.mutate({ id, to })}
        />
      )}
    </div>
  );
}
