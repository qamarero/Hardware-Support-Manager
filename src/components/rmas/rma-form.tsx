"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
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

interface RmaFormProps {
  providers: { id: string; name: string }[];
  incidents: { id: string; incidentNumber: string }[];
  clients: { id: string; name: string }[];
  defaultValues?: Partial<RmaFormInput>;
  onSubmit: (data: RmaFormInput) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function RmaForm({
  providers,
  incidents,
  clients,
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: RmaFormProps) {
  const form = useForm<RmaFormInput>({
    resolver: zodResolver(rmaFormSchema),
    defaultValues: {
      providerId: defaultValues?.providerId ?? "",
      incidentId: defaultValues?.incidentId ?? "",
      clientId: defaultValues?.clientId ?? "",
      deviceType: defaultValues?.deviceType ?? "",
      deviceBrand: defaultValues?.deviceBrand ?? "",
      deviceModel: defaultValues?.deviceModel ?? "",
      deviceSerialNumber: defaultValues?.deviceSerialNumber ?? "",
      clientLocal: defaultValues?.clientLocal ?? "",
      address: defaultValues?.address ?? "",
      postalCode: defaultValues?.postalCode ?? "",
      phone: defaultValues?.phone ?? "",
      trackingNumberOutgoing: defaultValues?.trackingNumberOutgoing ?? "",
      trackingNumberReturn: defaultValues?.trackingNumberReturn ?? "",
      providerRmaNumber: defaultValues?.providerRmaNumber ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Sección 1 — Relaciones */}
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
                      emptyMessage="No se encontró proveedor."
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
                  <FormLabel>Cliente</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={clients.map((c) => ({ value: c.id, label: c.name }))}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder="Sin cliente"
                      searchPlaceholder="Buscar cliente..."
                      emptyMessage="No se encontró cliente."
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
                      emptyMessage="No se encontró incidencia."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Sección 2 — Ubicación cliente */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Ubicación del cliente</h3>
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
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="Teléfono de contacto" {...field} />
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
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input placeholder="Dirección completa" {...field} />
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
                  <FormLabel>Código postal</FormLabel>
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

        {/* Sección 3 — Dispositivo */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Dispositivo</h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              control={form.control}
              name="deviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de dispositivo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        {/* Sección 4 — Seguimiento (solo en modo edición) */}
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
                      <FormLabel>Nº seguimiento envío</FormLabel>
                      <FormControl>
                        <Input placeholder="Tracking de envío" {...field} />
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
                      <FormLabel>Nº seguimiento devolución</FormLabel>
                      <FormControl>
                        <Input placeholder="Tracking de devolución" {...field} />
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
                      <FormLabel>Nº RMA proveedor</FormLabel>
                      <FormControl>
                        <Input placeholder="Nº RMA del proveedor" {...field} />
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

        {/* Sección 5 — Notas */}
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
    </Form>
  );
}
