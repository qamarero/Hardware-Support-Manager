"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { IncidentTemplatePicker } from "@/components/incidents/incident-template-picker";
import type { IncidentTemplate } from "@/lib/constants/incident-templates";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  createIncidentSchema,
  type CreateIncidentInput,
} from "@/lib/validators/incident";
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_PRIORITY_LABELS,
  HARDWARE_ORIGIN_LABELS,
} from "@/lib/constants/incidents";
import { DEVICE_TYPE_LABELS } from "@/lib/constants/device-types";
import { fetchClientsForSelect } from "@/server/actions/clients";
import {
  fetchArticleTypes,
  fetchArticleBrands,
  fetchArticleModels,
} from "@/server/actions/articles";

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
    mode: "onTouched",
    defaultValues: {
      clientId: defaultValues?.clientId ?? "",
      clientName: defaultValues?.clientName ?? "",
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      category: defaultValues?.category ?? "escalado",
      hardwareOrigin: defaultValues?.hardwareOrigin,
      priority: defaultValues?.priority ?? "media",
      assignedUserId: defaultValues?.assignedUserId ?? "",
      articleId: defaultValues?.articleId ?? "",
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const applyTemplate = (template: IncidentTemplate) => {
    const setIfEmpty = (field: keyof CreateIncidentInput, value: string) => {
      if (!form.getValues(field)) {
        form.setValue(field, value as never, { shouldDirty: true });
      }
    };
    setIfEmpty("category", template.category);
    setIfEmpty("priority", template.priority);
    setIfEmpty("deviceType", template.deviceType);
    setIfEmpty("title", template.title);
    setIfEmpty("description", template.description);
    setSelectedTemplateId(template.id);
    toast.success(`Plantilla aplicada: ${template.name}`);
  };

  const clearTemplate = () => {
    setSelectedTemplateId(null);
  };

  const { data: clientsData = [] } = useQuery({
    queryKey: ["clients", "select"],
    queryFn: () => fetchClientsForSelect(),
  });

  // Article cascading dropdowns
  const selectedDeviceType = form.watch("deviceType");
  const selectedDeviceBrand = form.watch("deviceBrand");

  const { data: articleTypes = [] } = useQuery({
    queryKey: ["article-types"],
    queryFn: () => fetchArticleTypes(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: articleBrands = [] } = useQuery({
    queryKey: ["article-brands", selectedDeviceType],
    queryFn: () => fetchArticleBrands(selectedDeviceType!),
    enabled: !!selectedDeviceType && selectedDeviceType !== "otro" && selectedDeviceType !== "desconocido",
    staleTime: 10 * 60 * 1000,
  });

  const { data: articleModels = [] } = useQuery({
    queryKey: ["article-models", selectedDeviceType, selectedDeviceBrand],
    queryFn: () => fetchArticleModels(selectedDeviceType!, selectedDeviceBrand!),
    enabled: !!selectedDeviceType && !!selectedDeviceBrand && selectedDeviceType !== "otro",
    staleTime: 10 * 60 * 1000,
  });

  // Reset brand/model when type changes
  useEffect(() => {
    if (selectedDeviceType) {
      form.setValue("deviceBrand", "");
      form.setValue("deviceModel", "");
      form.setValue("articleId", "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceType]);

  // Reset model when brand changes
  useEffect(() => {
    if (selectedDeviceBrand) {
      form.setValue("deviceModel", "");
      form.setValue("articleId", "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceBrand]);

  const clientOptions = clientsData.map((c: { id: string; name: string }) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Plantilla rápida (solo en creación) */}
        {mode === "create" && (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground mb-2">Plantilla rápida</p>
            <IncidentTemplatePicker
              onSelect={applyTemplate}
              onClear={clearTemplate}
              selectedId={selectedTemplateId}
            />
          </div>
        )}

        {/* Cliente y Referencia Intercom */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide"><span className="h-4 w-1 rounded-full bg-primary" />
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
          </div>

          {/*
           * G7: el campo "ID Escalación IC" se rellena automáticamente al convertir desde
           * la Bandeja Intercom (se deriva de la URL). Solo lo mostramos si ya tiene valor
           * (modo edición de algo que ya viene de Intercom). En modo creación nuevo lo
           * ocultamos para no añadir ruido. La URL Intercom sigue siendo editable a mano.
           */}
          <div className={`grid gap-4 ${form.watch("intercomEscalationId") ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
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

            {form.watch("intercomEscalationId") && (
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
            )}
          </div>
        </div>

        <Separator className="bg-border/40" />

        {/* Incidencia */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide"><span className="h-4 w-1 rounded-full bg-primary" />
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

        <Separator className="bg-border/40" />

        {/* Dispositivo */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide"><span className="h-4 w-1 rounded-full bg-primary" />
            Dispositivo
          </h3>

          <FormField
            control={form.control}
            name="hardwareOrigin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origen del hardware *</FormLabel>
                <FormControl>
                  <ToggleGroup
                    type="single"
                    value={field.value ?? ""}
                    onValueChange={(v) => { if (v) field.onChange(v); }}
                    className="justify-start gap-2"
                  >
                    <ToggleGroupItem
                      value="qamarero"
                      className="rounded-md border px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {HARDWARE_ORIGIN_LABELS.qamarero}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="cliente_reciclado"
                      className="rounded-md border px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {HARDWARE_ORIGIN_LABELS.cliente_reciclado}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                      {articleTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {DEVICE_TYPE_LABELS[type as keyof typeof DEVICE_TYPE_LABELS] ?? type}
                        </SelectItem>
                      ))}
                      <SelectItem value="otro">Otro</SelectItem>
                      <SelectItem value="desconocido">Desconocido</SelectItem>
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
                  {articleBrands.length > 0 ? (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar marca" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {articleBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input placeholder="Escribir marca" {...field} />
                    </FormControl>
                  )}
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
                  {articleModels.length > 0 ? (
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        const article = articleModels.find((a) => a.model === v);
                        if (article) form.setValue("articleId", article.id);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar modelo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {articleModels.map((a) => (
                          <SelectItem key={a.id} value={a.model}>{a.model}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input placeholder="Escribir modelo" {...field} />
                    </FormControl>
                  )}
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

        <Separator className="bg-border/40" />

        {/* Contacto y Recogida */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide"><span className="h-4 w-1 rounded-full bg-primary" />
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
