"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { IncidentStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import {
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_CATEGORY_LABELS,
  type IncidentPriority,
  type IncidentCategory,
} from "@/lib/constants/incidents";
import { DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import { formatDateTime } from "@/lib/utils/date-format";
import type { IncidentRow } from "@/server/queries/incidents";

const PRIORITY_COLORS: Record<string, string> = {
  baja: "bg-green-500/15 text-green-700 dark:bg-green-500/25 dark:text-green-300",
  media: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300",
  alta: "bg-orange-500/15 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300",
  critica: "bg-red-500/15 text-red-700 dark:bg-red-500/25 dark:text-red-300",
};

interface IncidentPreviewProps {
  incident: IncidentRow;
}

export function IncidentPreviewPopover({ incident }: IncidentPreviewProps) {
  const deviceParts = [
    incident.deviceType ? DEVICE_TYPE_LABELS[incident.deviceType as DeviceType] ?? incident.deviceType : null,
    incident.deviceBrand,
    incident.deviceModel,
  ].filter(Boolean);

  const clientName = incident.clientCompanyName ?? incident.clientName;

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
      <PopoverContent className="w-96 p-0" align="start" side="right" style={{ animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-primary">
              {incident.incidentNumber}
            </span>
            <IncidentStateBadge status={incident.status} />
            <Badge variant="outline" className={PRIORITY_COLORS[incident.priority] ?? ""}>
              {INCIDENT_PRIORITY_LABELS[incident.priority as IncidentPriority] ?? incident.priority}
            </Badge>
          </div>

          {/* Title */}
          <p className="text-sm font-medium leading-tight">{incident.title}</p>

          {/* Description */}
          {incident.description && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {incident.description}
            </p>
          )}

          {/* Info grid */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {incident.category && (
              <div>
                <dt className="text-muted-foreground">Categoría</dt>
                <dd className="font-medium">
                  {INCIDENT_CATEGORY_LABELS[incident.category as IncidentCategory] ?? incident.category}
                </dd>
              </div>
            )}
            {clientName && (
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium truncate">{clientName}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Asignado</dt>
              <dd className="font-medium">{incident.assignedUserName ?? "Sin asignar"}</dd>
            </div>
            {deviceParts.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Dispositivo</dt>
                <dd className="font-medium truncate">{deviceParts.join(" ")}</dd>
              </div>
            )}
            {incident.contactName && (
              <div>
                <dt className="text-muted-foreground">Contacto</dt>
                <dd className="font-medium">{incident.contactName}{incident.contactPhone ? ` · ${incident.contactPhone}` : ""}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Antigüedad</dt>
              <dd><AgingBadge stateChangedAt={incident.stateChangedAt} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Creado</dt>
              <dd className="font-medium">{formatDateTime(incident.createdAt)}</dd>
            </div>
          </dl>

          {/* Footer */}
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/incidents/${incident.id}`}>Ver detalle completo</Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
