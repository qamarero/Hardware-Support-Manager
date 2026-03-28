"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateClientDialog } from "@/components/shared/create-client-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  rmaFormSchema,
  type RmaFormInput,
} from "@/lib/validators/rma";
import { DEVICE_TYPE_LABELS } from "@/lib/constants/device-types";
import {
  fetchClientsForSelect,
  fetchClientLocationsForSelect,
} from "@/server/actions/clients";
import { fetchIncidentById } from "@/server/actions/incidents";
import type { ClientLocationRow } from "@/server/queries/clients";

interface RmaFormProps {
  providers: { id: string; name: string }[];
  incidents: { id: string; incidentNumber: string }[];
  defaultValues?: Partial<RmaFormInput>;
  onSubmit: (data: RmaFormInput) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function RmaForm({
  providers,
  incidents,
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: RmaFormProps) {
  const queryClient = useQueryClient();
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const form = useForm<RmaFormInput>({
    resolver: zodResolver(rmaFormSchema),
    defaultValues: {
      providerId: defaultValues?.providerId ?? "",
      incidentId: defaultValues?.incidentId ?? "",
      clientId: defaultValues?.clientId ?? "",
      clientLocationId: defaultValues?.clientLocationId ?? "",
      clientName: defaultValues?.clientName ?? "",
      clientExternalId: defaultValues?.clientExternalId ?? "",
      clientIntercomUrl: defaultValues?.clientIntercomUrl ?? "",
      deviceType: defaultValues?.deviceType ?? "",
      deviceBrand: defaultValues?.deviceBrand ?? "",
      deviceModel: defaultValues?.deviceModel ?? "",
      deviceSerialNumber: defaultValues?.deviceSerialNumber ?? "",
      clientLocal: defaultValues?.clientLocal ?? "",
      address: defaultValues?.address ?? "",
      postalCode: defaultValues?.postalCode ?? "",
      city: defaultValues?.city ?? "",
      phone: defaultValues?.phone ?? "",
      trackingNumberOutgoing: defaultValues?.trackingNumberOutgoing ?? "",
      trackingNumberReturn: defaultValues?.trackingNumberReturn ?? "",
      providerRmaNumber: defaultValues?.providerRmaNumber ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  const selectedClientId = form.watch("clientId");
  const selectedIncidentId = form.watch("incidentId");

  const { data: clientsData = [] } = useQuery({
    queryKey: ["clients", "select"],
    queryFn: () => fetchClientsForSelect(),
  });

  const { data: locationsData = [] } = useQuery({
    queryKey: ["client-locations", selectedClientId],
    queryFn: () => fetchClientLocationsForSelect(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const { data: incidentData } = useQuery({
    queryKey: ["incident-for-rma", selectedIncidentId],
    queryFn: () => fetchIncidentById(selectedIncidentId!),
    enabled: !!selectedIncidentId && !defaultValues,
  });

  // Track which incident was last auto-filled to avoid re-running on unrelated re-renders
  const lastAutoFilledIncidentId = useRef<string | null>(null);

  // Auto-fill RMA form from incident data when an incident is selected in create mode
  useEffect(() => {
    if (!incidentData || !selectedIncidentId || defaultValues) return;
    if (lastAutoFilledIncidentId.current === selectedIncidentId) return;

    lastAutoFilledIncidentId.current = selectedIncidentId;

    let didFill = false;

    const setIfEmpty = (field: keyof RmaFormInput, value: string | null | undefined) => {
      if (!value) return;
      const current = form.getValues(field);
      if (!current) {
        form.setValue(field, value as never, { shouldDirty: true });
        didFill = true;
      }
    };

    // Client identity
    if (incidentData.clientId) {
      const currentClientId = form.getValues("clientId");
      if (!currentClientId) {
        form.setValue("clientId", incidentData.clientId, { shouldDirty: true });
        didFill = true;
      }
    }

    if (incidentData.clientLocationId) {
      const currentLocationId = form.getValues("clientLocationId");
      if (!currentLocationId) {
        form.setValue("clientLocationId", incidentData.clientLocationId, { shouldDirty: true });
        didFill = true;
      }
    }

    // Device fields
    setIfEmpty("deviceType", incidentData.deviceType);
    setIfEmpty("deviceBrand", incidentData.deviceBrand);
    setIfEmpty("deviceModel", incidentData.deviceModel);
    setIfEmpty("deviceSerialNumber", incidentData.deviceSerialNumber);

    // Location / contact fields
    setIfEmpty("phone", incidentData.contactPhone);
    setIfEmpty("address", incidentData.pickupAddress);
    setIfEmpty("postalCode", incidentData.pickupPostalCode);
    setIfEmpty("city", incidentData.pickupCity);

    // Intercom
    setIfEmpty("clientIntercomUrl", incidentData.intercomUrl);

    if (didFill) {
      toast.success("Datos importados de la incidencia");
    }
  }, [incidentData, selectedIncidentId, defaultValues, form]);

  // Auto-fill from selected location
  const handleLocationChange = (locationId: string) => {
    form.setValue("clientLocationId", locationId);
    if (!locationId) return;
    const location = locationsData.find((l: ClientLocationRow) => l.id === locationId);
    if (location) {
      form.setValue("clientLocal", location.name ?? "");
      form.setValue("address", location.address ?? "");
      form.setValue("postalCode", location.postalCode ?? "");
      form.setValue("city", location.city ?? "");
      form.setValue("phone", location.contactPhone ?? "");
    }
  };

  // Reset location when client changes
  useEffect(() => {
    if (!selectedClientId) {
      form.setValue("clientLocationId", "");
    }
  }, [selectedClientId, form]);

  const clientOptions = clientsData.map((c: { id: string; name: string }) => ({
    value: c.id,
    label: c.name,
  }));

  const locationOptions = locationsData.map((l: ClientLocationRow) => ({
    value: l.id,
    label: l.name,
  }));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Seccion 1 — Relaciones */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Relaciones</h3>
          <div className="grid gap-6 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="providerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor *</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={providers.map((p) => ({ value: p.id, label: p.name }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Seleccionar proveedor"
                      searchPlaceholder="Buscar proveedor..."
                      emptyMessage="No se encontro proveedor."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente (empresa)</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={clientOptions}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder="Seleccionar cliente..."
                      searchPlaceholder="Buscar cliente..."
                      emptyMessage="No se encontraron clientes."
                      emptyAction={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setClientDialogOpen(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Crear nuevo cliente
                        </Button>
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="incidentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Incidencia vinculada</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={incidents.map((i) => ({ value: i.id, label: i.incidentNumber }))}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder="Sin vincular"
                      searchPlaceholder="Buscar incidencia..."
                      emptyMessage="No se encontro incidencia."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-3 mt-4">
            <FormField
              control={form.control}
              name="clientLocationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local / Sucursal</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={locationOptions}
                      value={field.value ?? ""}
                      onValueChange={handleLocationChange}
                      placeholder="Seleccionar local..."
                      searchPlaceholder="Buscar local..."
                      emptyMessage="Sin locales."
                      disabled={!selectedClientId}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre cliente (texto libre)</FormLabel>
                  <FormControl>
                    <Input placeholder="Si no hay cliente registrado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientExternalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID externo cliente</FormLabel>
                  <FormControl>
                    <Input placeholder="ID en sistema externo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-4">
            <FormField
              control={form.control}
              name="clientIntercomUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Intercom</FormLabel>
                  <FormControl>
                    <Input placeholder="https://app.intercom.com/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Seccion 2 — Ubicacion cliente */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Ubicacion del cliente</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="clientLocal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local / Establecimiento</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefono</FormLabel>
                  <FormControl>
                    <Input placeholder="Telefono de contacto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direccion</FormLabel>
                  <FormControl>
                    <Input placeholder="Direccion completa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciudad</FormLabel>
                  <FormControl>
                    <Input placeholder="Ciudad" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Codigo postal</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 28001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Seccion 3 — Dispositivo */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Dispositivo</h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              control={form.control}
              name="deviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de dispositivo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(DEVICE_TYPE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deviceBrand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Dell, HP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deviceModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Latitude 5520" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deviceSerialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>N de serie</FormLabel>
                  <FormControl>
                    <Input placeholder="N de serie" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Seccion 4 — Seguimiento (solo en modo edicion) */}
        {mode === "edit" && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Seguimiento</h3>
              <div className="grid gap-6 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="trackingNumberOutgoing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>N seguimiento envio</FormLabel>
                      <FormControl>
                        <Input placeholder="Tracking de envio" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trackingNumberReturn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>N seguimiento devolucion</FormLabel>
                      <FormControl>
                        <Input placeholder="Tracking de devolucion" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="providerRmaNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>N RMA proveedor</FormLabel>
                      <FormControl>
                        <Input placeholder="N RMA del proveedor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Seccion 5 — Notas */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Notas adicionales sobre el RMA"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando..."
              : mode === "create"
                ? "Crear RMA"
                : "Guardar Cambios"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/rmas">Cancelar</Link>
          </Button>
        </div>
      </form>

      <CreateClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onClientCreated={({ clientId, clientName }) => {
          queryClient.invalidateQueries({ queryKey: ["clients", "select"] });
          form.setValue("clientId", clientId);
          form.setValue("clientName", clientName);
        }}
      />
    </Form>
  );
}
