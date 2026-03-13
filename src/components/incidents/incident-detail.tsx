"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IncidentStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { AttachmentSection } from "@/components/shared/attachment-section";
import { SlaIndicator } from "@/components/shared/sla-indicator";
import { StateTransitionButtons } from "@/components/incidents/state-transition-buttons";
import { IncidentForm } from "@/components/incidents/incident-form";
import {
  updateIncident,
  fetchUsersForSelect,
} from "@/server/actions/incidents";
import { formatDateTime } from "@/lib/utils/date-format";
import { Badge } from "@/components/ui/badge";
import {
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_CATEGORY_LABELS,
  type IncidentStatus,
  type IncidentPriority,
  type IncidentCategory,
} from "@/lib/constants/incidents";
import type { IncidentRow } from "@/server/queries/incidents";
import { DEFAULT_SLA_THRESHOLDS } from "@/lib/constants/sla";
import { DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import type { CreateIncidentInput } from "@/lib/validators/incident";

const PRIORITY_COLORS: Record<string, string> = {
  baja: "bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:bg-green-500/25 dark:text-green-300",
  media: "bg-blue-500/15 text-blue-700 hover:bg-blue-500/15 dark:bg-blue-500/25 dark:text-blue-300",
  alta: "bg-orange-500/15 text-orange-700 hover:bg-orange-500/15 dark:bg-orange-500/25 dark:text-orange-300",
  critica: "bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:bg-red-500/25 dark:text-red-300",
};

interface IncidentDetailProps {
  incident: IncidentRow;
}

export function IncidentDetail({ incident }: IncidentDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
    enabled: isEditing,
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateIncidentInput) => updateIncident(incident.id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Incidencia actualizada correctamente");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al actualizar la incidencia");
    },
  });

  const handleTransitionComplete = () => {
    router.refresh();
  };

  if (isEditing) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Editar Incidencia</h1>
        <Card>
          <CardContent className="pt-6">
            <IncidentForm
              users={users}
              defaultValues={{
                clientName: incident.clientName ?? "",
                title: incident.title,
                description: incident.description ?? "",
                category: incident.category as IncidentCategory,
                priority: incident.priority as IncidentPriority,
                assignedUserId: incident.assignedUserId ?? "",
                deviceType: (incident.deviceType as CreateIncidentInput["deviceType"]) ?? "",
                deviceBrand: incident.deviceBrand ?? "",
                deviceModel: incident.deviceModel ?? "",
                deviceSerialNumber: incident.deviceSerialNumber ?? "",
              }}
              onSubmit={(data) => updateMutation.mutate(data)}
              isSubmitting={updateMutation.isPending}
              mode="edit"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{incident.incidentNumber}</h1>
            <IncidentStateBadge status={incident.status as IncidentStatus} />
            <Badge
              variant="outline"
              className={PRIORITY_COLORS[incident.priority] ?? ""}
            >
              {INCIDENT_PRIORITY_LABELS[incident.priority as IncidentPriority] ?? incident.priority}
            </Badge>
          </div>
          <p className="mt-1 text-lg text-muted-foreground">{incident.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsEditing(true)}>Editar</Button>
          <Button variant="outline" asChild>
            <Link href="/incidents">Volver</Link>
          </Button>
        </div>
      </div>

      {/* Transition buttons + SLA */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <StateTransitionButtons
          incidentId={incident.id}
          currentStatus={incident.status as IncidentStatus}
          onTransitionComplete={handleTransitionComplete}
        />
        <SlaIndicator
          createdAt={incident.createdAt}
          stateChangedAt={incident.stateChangedAt}
          resolvedAt={incident.resolvedAt}
          slaHours={DEFAULT_SLA_THRESHOLDS.resolution[incident.priority] ?? 168}
        />
      </div>

      {/* Info cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Cliente
                </dt>
                <dd className="mt-1 text-sm">{incident.clientName ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Asignado a
                </dt>
                <dd className="mt-1 text-sm">
                  {incident.assignedUserName ?? "Sin asignar"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Categoría
                </dt>
                <dd className="mt-1 text-sm">
                  {INCIDENT_CATEGORY_LABELS[incident.category as IncidentCategory] ?? incident.category}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Antigüedad
                </dt>
                <dd className="mt-1">
                  <AgingBadge stateChangedAt={incident.stateChangedAt} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Descripción
                </dt>
                <dd className="mt-1 text-sm whitespace-pre-wrap">
                  {incident.description || "-"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Tipo de dispositivo
                </dt>
                <dd className="mt-1 text-sm">
                  {incident.deviceType
                    ? DEVICE_TYPE_LABELS[incident.deviceType as DeviceType] ?? incident.deviceType
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Marca
                </dt>
                <dd className="mt-1 text-sm">{incident.deviceBrand || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Modelo
                </dt>
                <dd className="mt-1 text-sm">{incident.deviceModel || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Número de serie
                </dt>
                <dd className="mt-1 text-sm">
                  {incident.deviceSerialNumber || "-"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fechas</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Creada
              </dt>
              <dd className="mt-1 text-sm">{formatDateTime(incident.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Actualizada
              </dt>
              <dd className="mt-1 text-sm">{formatDateTime(incident.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Cambio de estado
              </dt>
              <dd className="mt-1 text-sm">
                {formatDateTime(incident.stateChangedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Resuelta
              </dt>
              <dd className="mt-1 text-sm">
                {incident.resolvedAt ? formatDateTime(incident.resolvedAt) : "-"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Attachments & Event Log */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AttachmentSection entityType="incident" entityId={incident.id} />
        <EventLogTimeline entityType="incident" entityId={incident.id} />
      </div>
    </div>
  );
}
