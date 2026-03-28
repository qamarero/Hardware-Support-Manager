"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  createIncidentSchema,
  type CreateIncidentInput,
} from "@/lib/validators/incident";
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_PRIORITY_LABELS,
} from "@/lib/constants/incidents";
import { DEVICE_TYPE_LABELS } from "@/lib/constants/device-types";
import {
  fetchClientsForSelect,
  fetchClientLocationsForSelect,
} from "@/server/actions/clients";
import type { ClientLocationRow } from "@/server/queries/clients";

interface IncidentFormProps {
  users: { id: string; name: string }[];
  defaultValues?: Partial<CreateIncidentInput>;
  onSubmit: (data: CreateIncidentInput) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function IncidentForm({
  users,
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: IncidentFormProps) {
  const form = useForm<CreateIncidentInput>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: {
      clientId: defaultValues?.clientId ?? "",
      clientLocationId: defaultValues?.clientLocationId ?? "",
      clientName: defaultValues?.clientName ?? "",
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      category: defaultValues?.category ?? "hardware",
      priority: defaultValues?.priority ?? "media",
      assignedUserId: defaultValues?.assignedUserId ?? "",
      deviceType: defaultValues?.deviceType ?? "",
      deviceBrand: defaultValues?.deviceBrand ?? "",
      deviceModel: defaultValues?.deviceModel ?? "",
      deviceSerialNumber: defaultValues?.deviceSerialNumber ?? "",
      intercomUrl: defaultValues?.intercomUrl ?? "",
      intercomEscalationId: defaultValues?.intercomEscalationId ?? "",
      contactName: defaultValues?.contactName ?? "",
      contactPhone: defaultValues?.contactPhone ?? "",
      pickupAddress: defaultValues?.pickupAddress ?? "",
      pickupPostalCode: defaultValues?.pickupPostalCode ?? "",
      pickupCity: defaultValues?.pickupCity ?? "",
    },
  });

  const queryClient = useQueryClient();
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const selectedClientId = form.watch("clientId");

  const { data: clientsData = [] } = useQuery({
    queryKey: ["clients", "select"],
    queryFn: () => fetchClientsForSelect(),
  });

  const { data: locationsData = [] } = useQuery({
    queryKey: ["client-locations", selectedClientId],
    queryFn: () => fetchClientLocationsForSelect(selectedClientId!),
    enabled: !!selectedClientId,
  });

  // Auto-fill from selected location
  const handleLocationChange = (locationId: string) => {
    form.setValue("clientLocationId", locationId);
    if (!locationId) return;
    const location = locationsData.find((l: ClientLocationRow) => l.id === locationId);
    if (location) {
      form.setValue("contactName", location.contactName ?? "");
      form.setValue("contactPhone", location.contactPhone ?? "");
      form.setValue("pickupAddress", location.address ?? "");
      form.setValue("pickupPostalCode", location.postalCode ?? "");
      form.setValue("pickupCity", location.city ?? "");
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
        {/* Cliente y Referencia Intercom */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Cliente y Referencia
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre cliente (texto libre)</FormLabel>
                <FormControl>
                  <Input placeholder="Si no hay cliente registrado, escribir nombre aquí" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="intercomUrl"
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

            <FormField
              control={form.control}
              name="intercomEscalationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Escalación IC</FormLabel>
                  <FormControl>
                    <Input placeholder="Folio o ID de la escalación" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Incidencia */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Incidencia
          </h3>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl>
                  <Input placeholder="Título de la incidencia" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Descripción detallada del problema"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(INCIDENT_CATEGORY_LABELS).map(
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
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridad</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar prioridad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(INCIDENT_PRIORITY_LABELS).map(
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
          </div>

          <FormField
            control={form.control}
            name="assignedUserId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asignado a</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Dispositivo */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Dispositivo
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    <Input placeholder="Ej: Dell, HP, Lenovo" {...field} />
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
                  <FormLabel>Nº de serie</FormLabel>
                  <FormControl>
                    <Input placeholder="Nº de serie" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Contacto y Recogida */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Contacto y Recogida
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona de contacto</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del contacto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono de contacto</FormLabel>
                  <FormControl>
                    <Input placeholder="Teléfono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="pickupAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección de recogida</FormLabel>
                <FormControl>
                  <Textarea placeholder="Dirección completa" rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="pickupCity"
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
              name="pickupPostalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código Postal</FormLabel>
                  <FormControl>
                    <Input placeholder="CP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando..."
              : mode === "create"
                ? "Crear Incidencia"
                : "Guardar Cambios"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/incidents">Cancelar</Link>
          </Button>
        </div>
      </form>

      <CreateClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        initialName=""
        onClientCreated={({ clientId, clientName }) => {
          queryClient.invalidateQueries({ queryKey: ["clients", "select"] });
          form.setValue("clientId", clientId);
          form.setValue("clientName", clientName);
        }}
      />
    </Form>
  );
}
