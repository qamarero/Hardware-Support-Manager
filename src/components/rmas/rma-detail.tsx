"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RmaStateBadge } from "@/components/shared/state-badge";
import { AgingBadge } from "@/components/shared/aging-badge";
import { EventLogTimeline } from "@/components/shared/event-log-timeline";
import { AttachmentSection } from "@/components/shared/attachment-section";
import { RmaTransitionButtons } from "@/components/rmas/state-transition-buttons";
import { RmaForm } from "@/components/rmas/rma-form";
import { updateRma, fetchProvidersForSelect, fetchClientsForRmaSelect } from "@/server/actions/rmas";
import { fetchIncidentsForSelect } from "@/server/actions/incidents";
import { formatDateTime } from "@/lib/utils/date-format";
import { DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import type { RmaStatus } from "@/lib/constants/rmas";
import type { RmaRow } from "@/server/queries/rmas";
import type { RmaFormInput } from "@/lib/validators/rma";

interface RmaDetailProps {
  rma: RmaRow;
}

export function RmaDetail({ rma: initialRma }: RmaDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rma] = useState(initialRma);

  const { data: providers = [] } = useQuery({
    queryKey: ["providers", "select"],
    queryFn: () => fetchProvidersForSelect(),
    enabled: isEditing,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", "select"],
    queryFn: () => fetchIncidentsForSelect(),
    enabled: isEditing,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "select"],
    queryFn: () => fetchClientsForRmaSelect(),
    enabled: isEditing,
  });

  const updateMutation = useMutation({
    mutationFn: (data: RmaFormInput) => updateRma(rma.id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("RMA actualizado correctamente");
        setIsEditing(false);
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
    router.refresh();
  };

  if (isEditing) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Editar RMA</h1>
        <Card>
          <CardContent className="pt-6">
            <RmaForm
              providers={providers}
              incidents={incidents}
              clients={clients}
              defaultValues={{
                providerId: rma.providerId,
                incidentId: rma.incidentId ?? "",
                clientId: rma.clientId ?? "",
                deviceType: (rma.deviceType as RmaFormInput["deviceType"]) ?? "",
                deviceBrand: rma.deviceBrand ?? "",
                deviceModel: rma.deviceModel ?? "",
                deviceSerialNumber: rma.deviceSerialNumber ?? "",
                clientLocal: rma.clientLocal ?? "",
                address: rma.address ?? "",
                postalCode: rma.postalCode ?? "",
                phone: rma.phone ?? "",
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
    );
  }

  const deviceTypeLabel = rma.deviceType
    ? DEVICE_TYPE_LABELS[rma.deviceType as DeviceType] ?? rma.deviceType
    : "-";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          <Button onClick={() => setIsEditing(true)}>Editar</Button>
          <Button variant="outline" asChild>
            <Link href="/rmas">Volver</Link>
          </Button>
        </div>
      </div>

      {/* Transition buttons */}
      <RmaTransitionButtons
        rmaId={rma.id}
        currentStatus={rma.status as RmaStatus}
        onTransitionComplete={handleTransitionComplete}
      />

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
                  Proveedor
                </dt>
                <dd className="mt-1 text-sm">{rma.providerName ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Cliente
                </dt>
                <dd className="mt-1 text-sm">{rma.clientName ?? "-"}</dd>
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
                  <AgingBadge stateChangedAt={rma.stateChangedAt} />
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
          <Card>
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

          {(rma.clientLocal || rma.address || rma.postalCode || rma.phone) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ubicación del cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Local
                    </dt>
                    <dd className="mt-1 text-sm">{rma.clientLocal || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Teléfono
                    </dt>
                    <dd className="mt-1 text-sm">{rma.phone || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Dirección
                    </dt>
                    <dd className="mt-1 text-sm">{rma.address || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Código postal
                    </dt>
                    <dd className="mt-1 text-sm">{rma.postalCode || "-"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dates */}
      <Card>
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
      <div className="grid gap-6 lg:grid-cols-2">
        <AttachmentSection entityType="rma" entityId={rma.id} />
        <EventLogTimeline entityType="rma" entityId={rma.id} />
      </div>
    </div>
  );
}
