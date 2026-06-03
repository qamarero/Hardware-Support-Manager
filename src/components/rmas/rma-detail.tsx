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
import { ManualNoteForm } from "@/components/shared/manual-note-form";
import { ConversationThread } from "@/components/intercom/conversation-thread";
import { extractConversationId } from "@/lib/intercom/sync";
import { RmaTransitionButtons } from "@/components/rmas/state-transition-buttons";
import { RmaForm } from "@/components/rmas/rma-form";
import { updateRma, fetchProvidersForSelect } from "@/server/actions/rmas";
import { fetchIncidentsForSelect, fetchIncidentById } from "@/server/actions/incidents";
import { DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import type { RmaStatus } from "@/lib/constants/rmas";
import { CLOSED_RMA_STATUSES } from "@/lib/constants/statuses";
import { invalidateRmaQueries } from "@/lib/query-keys";
import type { RmaRow } from "@/server/queries/rmas";
import type { RmaFormInput } from "@/lib/validators/rma";
import { TemplatePicker } from "@/components/message-templates/template-picker";
import { Loader2, Building2 } from "lucide-react";

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

  // Fetch linked incident so templates can render incident-level variables
  // (description, category, hardwareOrigin, pickup*, intercomUrl, etc.).
  // Without this, templates referencing those vars render as {{var}}
  // placeholders since the RMA row alone doesn't carry that data.
  const { data: linkedIncident } = useQuery({
    queryKey: ["incident-for-template", rma.incidentId],
    queryFn: () => fetchIncidentById(rma.incidentId!),
    enabled: !!rma.incidentId,
    staleTime: 5 * 60 * 1000,
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
          {/* U3: resumen humano — proveedor + cliente + antigüedad de un vistazo. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {rma.providerName && (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {rma.providerName}
              </span>
            )}
            {(rma.clientCompanyName || rma.clientName) && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{rma.clientCompanyName ?? rma.clientName}</span>
              </>
            )}
            <span className="text-muted-foreground/40">·</span>
            <AgingBadge
              stateChangedAt={rma.stateChangedAt}
              createdAt={rma.createdAt}
              status={rma.status}
              closedStatuses={CLOSED_RMA_STATUSES}
              pausedStatuses={[]}
            />
          </div>
          {rma.incidentNumber && (
            <p className="mt-1 text-sm text-muted-foreground">
              Vinculado a{" "}
              <Link
                href={`/incidents/${rma.incidentId}`}
                className="text-primary hover:underline font-medium"
              >
                {rma.incidentNumber}
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TemplatePicker
            context={{
              // RMA-specific fields
              rmaNumber: rma.rmaNumber,
              providerName: rma.providerName ?? "",
              providerRmaNumber: rma.providerRmaNumber ?? "",
              trackingNumberOutgoing: rma.trackingNumberOutgoing ?? "",
              trackingNumberReturn: rma.trackingNumberReturn ?? "",

              // Linked incident — prefer incident data when available so templates
              // referencing incident-level vars work (title, description, category, etc.)
              incidentNumber: rma.incidentNumber ?? "",
              title: linkedIncident?.title ?? "",
              description: linkedIncident?.description ?? "",
              category: linkedIncident?.category ?? "",
              hardwareOrigin: linkedIncident?.hardwareOrigin ?? "",
              priority: linkedIncident?.priority ?? "",
              assignedUserName: linkedIncident?.assignedUserName ?? "",
              intercomUrl: linkedIncident?.intercomUrl ?? "",
              intercomEscalationId: linkedIncident?.intercomEscalationId ?? "",

              // Shared between incident and RMA — RMA values override (more recent)
              status: rma.status,
              clientName: rma.clientCompanyName ?? rma.clientName ?? linkedIncident?.clientCompanyName ?? linkedIncident?.clientName ?? "",
              deviceType: rma.deviceType
                ? DEVICE_TYPE_LABELS[rma.deviceType as DeviceType] ?? rma.deviceType
                : (linkedIncident?.deviceType ?? ""),
              deviceBrand: rma.deviceBrand ?? linkedIncident?.deviceBrand ?? "",
              deviceModel: rma.deviceModel ?? linkedIncident?.deviceModel ?? "",
              deviceSerialNumber: rma.deviceSerialNumber ?? linkedIncident?.deviceSerialNumber ?? "",
              contactName: rma.contactName ?? linkedIncident?.contactName ?? "",
              contactPhone: rma.contactPhone ?? linkedIncident?.contactPhone ?? "",
              pickupAddress: rma.pickupAddress ?? linkedIncident?.pickupAddress ?? "",
              pickupCity: rma.pickupCity ?? linkedIncident?.pickupCity ?? "",
              pickupPostalCode: rma.pickupPostalCode ?? linkedIncident?.pickupPostalCode ?? "",
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

      {/* Intercom */}
      <div style={{ animation: 'fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both' }}>
        {(() => {
          const conversationId = extractConversationId(rma.clientIntercomUrl ?? "");
          return (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-lg">Referencia Intercom</CardTitle>
                {rma.clientIntercomUrl && (
                  <a
                    href={rma.clientIntercomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Abrir conversación ↗
                  </a>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <ManualNoteForm
                  entityType="rma"
                  entityId={rma.id}
                  intercomConversationId={conversationId}
                />
                {conversationId && (
                  <ConversationThread conversationId={conversationId} />
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Attachments & Event Log */}
      <div className="grid gap-4 md:gap-6 md:grid-cols-2" style={{ animation: 'fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) 320ms both' }}>
        <AttachmentSection entityType="rma" entityId={rma.id} />
        <EventLogTimeline entityType="rma" entityId={rma.id} />
      </div>
    </div>
  );
}
