"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RmaStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { AttachmentSection } from "@/components/shared/attachment-section";
import { RmaTransitionButtons } from "@/components/rmas/state-transition-buttons";
import { RmaForm } from "@/components/rmas/rma-form";
import { updateRma, fetchProvidersForSelect } from "@/server/actions/rmas";
import { fetchIncidentsForSelect } from "@/server/actions/incidents";
import { formatDateTime } from "@/lib/utils/date-format";
import { DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import type { RmaStatus } from "@/lib/constants/rmas";
import { CLOSED_RMA_STATUSES } from "@/lib/constants/statuses";
import { invalidateRmaQueries } from "@/lib/query-keys";
import type { RmaRow } from "@/server/queries/rmas";
import type { RmaFormInput } from "@/lib/validators/rma";
import { TemplatePicker } from "@/components/message-templates/template-picker";
import { Loader2 } from "lucide-react";

interface RmaDetailProps {
  rma: RmaRow;
}

export function RmaDetail({ rma }: RmaDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: providers = [], isLoading: isLoadingProviders } = useQuery({
    queryKey: ["providers", "select"],
    queryFn: () => fetchProvidersForSelect(),
    enabled: isEditing,
  });

  const { data: incidents = [], isLoading: isLoadingIncidents } = useQuery({
    queryKey: ["incidents", "select"],
    queryFn: () => fetchIncidentsForSelect(),
    enabled: isEditing,
  });

  const updateMutation = useMutation({
    mutationFn: (data: RmaFormInput) => updateRma(rma.id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("RMA actualizado correctamente");
        setIsEditing(false);
        invalidateRmaQueries(queryClient);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al actualizar el RMA");
    },
  });

  const handleTransitionComplete = () => {
    invalidateRmaQueries(queryClient);
    router.refresh();
  };

  if (isEditing) {
    if (isLoadingProviders || isLoadingIncidents) {
      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Editar RMA</h1>
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando datos...</span>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Editar RMA</h1>
        <div style={{ animation: 'fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
        <Card>
          <CardContent className="pt-6">
            <RmaForm
              providers={providers}
              incidents={incidents}
              defaultValues={{
                providerId: rma.providerId,
                incidentId: rma.incidentId ?? "",
                clientId: rma.clientId ?? "",
                clientName: rma.clientName ?? "",
                clientExternalId: rma.clientExternalId ?? "",
                clientIntercomUrl: rma.clientIntercomUrl ?? "",
                deviceType: (rma.deviceType as RmaFormInput["deviceType"]) ?? "",
                deviceBrand: rma.deviceBrand ?? "",
                deviceModel: rma.deviceModel ?? "",
                deviceSerialNumber: rma.deviceSerialNumber ?? "",
                contactName: rma.contactName ?? "",
                contactPhone: rma.contactPhone ?? "",
                pickupAddress: rma.pickupAddress ?? "",
                pickupPostalCode: rma.pickupPostalCode ?? "",
                pickupCity: rma.pickupCity ?? "",
                trackingNumberOutgoing: rma.trackingNumberOutgoing ?? "",
                trackingNumberReturn: rma.trackingNumberReturn ?? "",
                providerRmaNumber: rma.providerRmaNumber ?? "",
                notes: rma.notes ?? "",
              }}
              onSubmit={(data) => updateMutation.mutate(data)}
              isSubmitting={updateMutation.isPending}
              mode="edit"
            />
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  const deviceTypeLabel = rma.deviceType
    ? DEVICE_TYPE_LABELS[rma.deviceType as DeviceType] ?? rma.deviceType
    : "-";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" style={{ animation: 'fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) 0ms both' }}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{rma.rmaNumber}</h1>
            <RmaStateBadge status={rma.status as RmaStatus} />
          </div>
          {rma.incidentNumber && (
            <p className="mt-1 text-sm text-muted-foreground">
              Vinculado a{" "}
              <Link
                href={`/incidents/${rma.incidentId}`}
                className="text-primary hover:underline"
              >
                {rma.incidentNumber}
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TemplatePicker
            context={{
              rmaNumber: rma.rmaNumber,
              clientName: rma.clientCompanyName ?? rma.clientName ?? "",
              providerName: rma.providerName ?? "",
              providerRmaNumber: rma.providerRmaNumber ?? "",
              incidentNumber: rma.incidentNumber ?? "",
              status: rma.status,
              deviceType: rma.deviceType
                ? DEVICE_TYPE_LABELS[rma.deviceType as DeviceType] ?? rma.deviceType
                : "",
              deviceBrand: rma.deviceBrand ?? "",
              deviceModel: rma.deviceModel ?? "",
              deviceSerialNumber: rma.deviceSerialNumber ?? "",
              trackingNumberOutgoing: rma.trackingNumberOutgoing ?? "",
              trackingNumberReturn: rma.trackingNumberReturn ?? "",
              contactName: rma.contactName ?? "",
              address: rma.pickupAddress ?? "",
              postalCode: rma.pickupPostalCode ?? "",
              city: rma.pickupCity ?? "",
              phone: rma.contactPhone ?? "",
            }}
          />
          <Button onClick={() => setIsEditing(true)}>Editar</Button>
          <Button variant="outline" asChild>
            <Link href="/rmas">Volver</Link>
          </Button>
        </div>
      </div>

      {/* Transition buttons */}
      <div style={{ animation: 'fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both' }}>
      <RmaTransitionButtons
        rmaId={rma.id}
        currentStatus={rma.status as RmaStatus}
        onTransitionComplete={handleTransitionComplete}
      />
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:gap-6 md:grid-cols-2" style={{ animation: 'fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) 160ms both' }}>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
          <CardHeader>
            <CardTitle className="text-lg">Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Proveedor
                </dt>
                <dd className="mt-1 text-sm">{rma.providerName ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Cliente
                </dt>
                <dd className="mt-1 text-sm">
                  {rma.clientId ? (
                    <Link href={`/clients/${rma.clientId}`} className="text-primary hover:underline">
                      {rma.clientCompanyName ?? rma.clientName ?? "-"}
                    </Link>
                  ) : (
                    rma.clientName ?? "-"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  ID externo cliente
                </dt>
                <dd className="mt-1 text-sm">{rma.clientExternalId || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  URL Intercom
                </dt>
                <dd className="mt-1 text-sm">
                  {rma.clientIntercomUrl ? (
                    <a
                      href={rma.clientIntercomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {rma.clientIntercomUrl}
                    </a>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Nº RMA Proveedor
                </dt>
                <dd className="mt-1 text-sm">
                  {rma.providerRmaNumber || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Antigüedad
                </dt>
                <dd className="mt-1">
                  <AgingBadge
                    stateChangedAt={rma.stateChangedAt}
                    createdAt={rma.createdAt}
                    status={rma.status}
                    closedStatuses={CLOSED_RMA_STATUSES}
                    pausedStatuses={[]}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Incidencia vinculada
                </dt>
                <dd className="mt-1 text-sm">
                  {rma.incidentNumber ? (
                    <Link
                      href={`/incidents/${rma.incidentId}`}
                      className="text-primary hover:underline"
                    >
                      {rma.incidentNumber}
                    </Link>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Notas
                </dt>
                <dd className="mt-1 text-sm whitespace-pre-wrap">
                  {rma.notes || "-"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
            <CardHeader>
              <CardTitle className="text-lg">Dispositivo y Envío</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Tipo de dispositivo
                  </dt>
                  <dd className="mt-1 text-sm">{deviceTypeLabel}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Marca
                  </dt>
                  <dd className="mt-1 text-sm">{rma.deviceBrand || "-"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Modelo
                  </dt>
                  <dd className="mt-1 text-sm">{rma.deviceModel || "-"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Número de serie
                  </dt>
                  <dd className="mt-1 text-sm">
                    {rma.deviceSerialNumber || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Tracking envío
                  </dt>
                  <dd className="mt-1 text-sm">
                    {rma.trackingNumberOutgoing || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Tracking devolución
                  </dt>
                  <dd className="mt-1 text-sm">
                    {rma.trackingNumberReturn || "-"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {(rma.contactName || rma.contactPhone || rma.pickupAddress || rma.pickupPostalCode || rma.pickupCity) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contacto y Recogida</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Persona de contacto
                    </dt>
                    <dd className="mt-1 text-sm">{rma.contactName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Teléfono
                    </dt>
                    <dd className="mt-1 text-sm">{rma.contactPhone || "-"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-muted-foreground">
                      Dirección de recogida
                    </dt>
                    <dd className="mt-1 text-sm">
                      {[rma.pickupAddress, rma.pickupCity, rma.pickupPostalCode].filter(Boolean).join(", ") || "-"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dates */}
      <Card style={{ animation: 'fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both' }}>
        <CardHeader>
          <CardTitle className="text-lg">Fechas</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Creado
              </dt>
              <dd className="mt-1 text-sm">{formatDateTime(rma.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Actualizado
              </dt>
              <dd className="mt-1 text-sm">{formatDateTime(rma.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Cambio de estado
              </dt>
              <dd className="mt-1 text-sm">
                {formatDateTime(rma.stateChangedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Attachments & Event Log */}
      <div className="grid gap-4 md:gap-6 md:grid-cols-2" style={{ animation: 'fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) 320ms both' }}>
        <AttachmentSection entityType="rma" entityId={rma.id} />
        <EventLogTimeline entityType="rma" entityId={rma.id} />
      </div>
    </div>
  );
}
