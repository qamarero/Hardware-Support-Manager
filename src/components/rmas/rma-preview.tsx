"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RmaStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import { DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import type { RmaRow } from "@/server/queries/rmas";

interface RmaPreviewProps {
  rma: RmaRow;
}

export function RmaPreviewPopover({ rma }: RmaPreviewProps) {
  const deviceParts = [
    rma.deviceType ? DEVICE_TYPE_LABELS[rma.deviceType as DeviceType] ?? rma.deviceType : null,
    rma.deviceBrand,
    rma.deviceModel,
  ].filter(Boolean);

  const clientName = rma.clientCompanyName ?? rma.clientName;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="eye-blink inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Eye className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="right">
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-primary">
              {rma.rmaNumber}
            </span>
            <RmaStateBadge status={rma.status} />
          </div>

          {/* Info grid */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {rma.providerName && (
              <div>
                <dt className="text-muted-foreground">Proveedor</dt>
                <dd className="font-medium truncate">{rma.providerName}</dd>
              </div>
            )}
            {clientName && (
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium truncate">{clientName}</dd>
              </div>
            )}
            {deviceParts.length > 0 && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Dispositivo</dt>
                <dd className="font-medium">{deviceParts.join(" ")}</dd>
              </div>
            )}
            {rma.deviceSerialNumber && (
              <div>
                <dt className="text-muted-foreground">Nº Serie</dt>
                <dd className="font-mono font-medium text-[11px]">{rma.deviceSerialNumber}</dd>
              </div>
            )}
            {rma.providerRmaNumber && (
              <div>
                <dt className="text-muted-foreground">RMA Proveedor</dt>
                <dd className="font-mono font-medium text-[11px]">{rma.providerRmaNumber}</dd>
              </div>
            )}
            {rma.trackingNumberOutgoing && (
              <div>
                <dt className="text-muted-foreground">Tracking envío</dt>
                <dd className="font-mono font-medium text-[11px] truncate">{rma.trackingNumberOutgoing}</dd>
              </div>
            )}
            {rma.trackingNumberReturn && (
              <div>
                <dt className="text-muted-foreground">Tracking retorno</dt>
                <dd className="font-mono font-medium text-[11px] truncate">{rma.trackingNumberReturn}</dd>
              </div>
            )}
            {rma.incidentNumber && (
              <div>
                <dt className="text-muted-foreground">Incidencia</dt>
                <dd className="font-medium text-primary">{rma.incidentNumber}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Antigüedad</dt>
              <dd><AgingBadge stateChangedAt={rma.stateChangedAt} /></dd>
            </div>
          </dl>

          {/* Notes */}
          {rma.notes && (
            <div className="text-xs">
              <span className="text-muted-foreground">Notas: </span>
              <span className="line-clamp-2">{rma.notes}</span>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/rmas/${rma.id}`}>Ver detalle completo</Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
