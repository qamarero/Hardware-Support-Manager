"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, RefreshCw, Truck, X } from "lucide-react";
import { RmaShippingDialog } from "./rma-shipping-dialog";
import { requestRmaPickup, cancelRmaPickup, syncRmaPickup } from "@/server/actions/rma-pickups";
import { pickupBlockers } from "@/lib/mainops/pickup-request";
import {
  PICKUP_STATUS_BADGE,
  PICKUP_STATUS_LABELS,
  canCancelPickup,
  formatPickupIncidence,
  formatPickupWindow,
  isActivePickup,
} from "@/lib/mainops/pickup-status";
import { formatDateTime } from "@/lib/utils/date-format";
import type { RmaRow } from "@/server/queries/rmas";
import type { RmaPickup } from "@/lib/db/schema/rmas";

/** Detalle en gris al lado del badge: cuándo, código TIPSA, incidencia, albarán. */
function PickupDetail({ pickup }: { pickup: RmaPickup }) {
  const sep = <span aria-hidden> · </span>;
  switch (pickup.status) {
    case "solicitada":
      return <span className="text-xs muted">Logística aún no la ha mandado a TIPSA</span>;
    case "programada": {
      const when = formatPickupWindow(pickup);
      return (
        <span className="text-xs muted">
          {when ?? "Sin fecha"}
          {pickup.tipsa_code && <>{sep}TIPSA <span className="mono">{pickup.tipsa_code}</span></>}
          {pickup.last_event?.label && <>{sep}{pickup.last_event.label}</>}
        </span>
      );
    }
    case "incidencia":
      return (
        <span className="text-xs muted">
          {formatPickupIncidence(pickup) ?? "TIPSA no ha dado el motivo"}
          {pickup.tipsa_code && <>{sep}TIPSA <span className="mono">{pickup.tipsa_code}</span></>}
        </span>
      );
    case "en_curso":
    case "recibida":
      return pickup.albaran ? (
        <span className="text-xs muted">Albarán <span className="mono">{pickup.albaran}</span></span>
      ) : null;
    case "anulada":
      return <span className="text-xs muted">{pickup.cancel_reason ?? "Sin motivo"}</span>;
  }
}

/** id del bloque «Recogida» del drawer, para que la barra pueda llevar hasta él. */
export const PICKUP_BLOCK_ID = "rma-recogida";

/** RMAs en los que ya no tiene sentido pedir una recogida. */
const CLOSED_RMA_STATUSES = ["cerrado", "cancelado"];

/**
 * ¿Se ofrece «Pedir recogida» en este RMA? No depende de la logística: aunque
 * el proveedor «recoja y envíe», casi siempre lo recoge en nuestra oficina, así
 * que el equipo del cliente lo traemos nosotros igual.
 */
function pickupOffer(rma: RmaRow): { visible: boolean; blockers: string[] } {
  if (isActivePickup(rma.pickup) || CLOSED_RMA_STATUSES.includes(rma.status)) {
    return { visible: false, blockers: [] };
  }
  return { visible: true, blockers: pickupBlockers(rma) };
}

function useInvalidatePickup(rmaId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["rma-detail", rmaId] });
    qc.invalidateQueries({ queryKey: ["rmas-v2"] });
    qc.invalidateQueries({ queryKey: ["event-logs", "rma", rmaId] });
  };
}

/** «Pedir recogida a MainOps», compartido por el bloque y la barra del RMA. */
function useRequestPickup(rmaId: string) {
  const invalidate = useInvalidatePickup(rmaId);
  return useMutation({
    mutationFn: () => requestRmaPickup(rmaId),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      invalidate();
      if (r.data.created) toast.success("Recogida pedida: logística la programará con TIPSA desde MainOps");
      else toast.info(`MainOps ya tenía una recogida de este RMA (${PICKUP_STATUS_LABELS[r.data.pickup.status]})`);
    },
    onError: () => toast.error("No se pudo pedir la recogida"),
  });
}

/**
 * Botón de la barra de acciones del RMA, siempre a la vista. Si faltan datos,
 * en vez de pedirla dice cuáles y lleva al bloque «Recogida», donde está el
 * botón «Datos de recogida/envío».
 */
export function RmaPickupFooterButton({ rma }: { rma: RmaRow }) {
  const requestM = useRequestPickup(rma.id);
  const { visible, blockers } = pickupOffer(rma);
  if (!visible) return null;

  const onClick = () => {
    if (blockers.length > 0) {
      toast.error(`Antes de pedir la recogida: ${blockers.join(" ")}`);
      document.getElementById(PICKUP_BLOCK_ID)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    requestM.mutate();
  };

  return (
    <button
      type="button"
      className="btn btn--outline btn--sm"
      onClick={onClick}
      disabled={requestM.isPending}
      title="MainOps la recibe en Logística → Recogidas y la programa con TIPSA"
    >
      {requestM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />} Pedir recogida
    </button>
  );
}

/**
 * Recogida TIPSA pedida a MainOps, dentro del bloque «Recogida» del drawer.
 *
 * Sin recogida en marcha (y con el RMA abierto) ofrece pedirla; si faltan datos
 * dice cuáles debajo de los botones (`pickupBlockers`). Con recogida, enseña su
 * estado (lo actualiza el webhook de MainOps) y deja anularla mientras siga
 * `solicitada` o sincronizar a mano.
 */
export function RmaPickupSection({ rma }: { rma: RmaRow }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState("");

  const pickup = rma.pickup ?? null;
  const { visible, blockers } = pickupOffer(rma);
  const canOffer = visible && blockers.length === 0;

  const invalidate = useInvalidatePickup(rma.id);
  const requestM = useRequestPickup(rma.id);

  const cancelM = useMutation({
    mutationFn: () => cancelRmaPickup(rma.id, reason.trim() || undefined),
    onSuccess: (r) => {
      // Si falla, puede haberse resincronizado (409): se refresca igualmente.
      invalidate();
      if (!r.success) { toast.error(r.error); return; }
      setConfirmCancel(false);
      setReason("");
      toast.success("Solicitud de recogida anulada");
    },
    onError: () => toast.error("No se pudo anular la recogida"),
  });

  const syncM = useMutation({
    mutationFn: () => syncRmaPickup(rma.id),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      invalidate();
      if (!r.data.found) toast.info("MainOps no tiene ninguna recogida de este RMA");
      else if (r.data.changed && r.data.pickup) toast.success(`Recogida actualizada: ${PICKUP_STATUS_LABELS[r.data.pickup.status]}`);
      else toast.success("La recogida ya estaba al día");
    },
    onError: () => toast.error("No se pudo sincronizar con MainOps"),
  });

  const busy = requestM.isPending || cancelM.isPending || syncM.isPending;

  return (
    <>
      {pickup && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            className={`badge badge--dot ${PICKUP_STATUS_BADGE[pickup.status] ?? "badge--gray"}`}
            title={`Recogida ${pickup.pickup_id} en MainOps · actualizada ${formatDateTime(pickup.updated_at)}`}
          >
            {PICKUP_STATUS_LABELS[pickup.status] ?? pickup.status_label ?? pickup.status}
          </span>
          <PickupDetail pickup={pickup} />
        </div>
      )}

      {confirmCancel && canCancelPickup(pickup) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="text-sm" style={{ color: "var(--danger)", whiteSpace: "nowrap" }}>¿Anular la solicitud?</span>
          <input
            className="input"
            style={{ flex: 1, minWidth: 160, height: 32, padding: "6px 10px", fontSize: 12 }}
            placeholder="Motivo (opcional)"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !cancelM.isPending) cancelM.mutate(); }}
            autoFocus
          />
          <button className="btn btn--danger btn--sm" onClick={() => cancelM.mutate()} disabled={cancelM.isPending}>
            {cancelM.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Sí, anular
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => { setConfirmCancel(false); setReason(""); }} disabled={cancelM.isPending}>
            No
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginTop: 2 }}>
        {canOffer && (
          <button
            className="btn btn--primary btn--sm"
            onClick={() => requestM.mutate()}
            disabled={busy}
            title="MainOps la recibe en Logística → Recogidas y la programa con TIPSA"
          >
            {requestM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Pedir recogida a MainOps
          </button>
        )}
        {canCancelPickup(pickup) && !confirmCancel && (
          <button className="btn btn--outline btn--sm" onClick={() => setConfirmCancel(true)} disabled={busy}>
            <X size={14} /> Anular
          </button>
        )}
        {pickup && (
          <button
            className="btn btn--outline btn--sm"
            onClick={() => syncM.mutate()}
            disabled={busy}
            title="Trae de MainOps el último estado, por si se perdió un aviso"
          >
            <RefreshCw size={14} className={syncM.isPending ? "animate-spin" : undefined} /> Sincronizar
          </button>
        )}
        <RmaShippingDialog rma={rma} />
      </div>

      {/* Una linea por causa, debajo de los botones: en la fila de botones
          dos frases largas se partian entre ellos. */}
      {blockers.length > 0 && (
        <div className="text-xs muted" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontWeight: 600, color: "var(--fg-primary)" }}>Para pedir la recogida a MainOps:</span>
          {blockers.map((b) => (
            <span key={b}>· {b}</span>
          ))}
        </div>
      )}
    </>
  );
}
