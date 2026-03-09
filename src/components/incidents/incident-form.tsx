"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface IncidentFormProps {
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
  defaultValues?: Partial<CreateIncidentInput>;
  onSubmit: (data: CreateIncidentInput) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function IncidentForm({
  clients,
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
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      category: defaultValues?.category ?? "hardware",
      priority: defaultValues?.priority ?? "media",
      assignedUserId: defaultValues?.assignedUserId ?? "",
      deviceType: defaultValues?.deviceType ?? "",
      deviceBrand: defaultValues?.deviceBrand ?? "",
      deviceModel: defaultValues?.deviceModel ?? "",
      deviceSerialNumber: defaultValues?.deviceSerialNumber ?? "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente *</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Seleccionar cliente"
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

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormLabel>Marca del dispositivo</FormLabel>
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
                <FormLabel>Modelo del dispositivo</FormLabel>
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
                <FormLabel>Número de serie</FormLabel>
                <FormControl>
                  <Input placeholder="Nº de serie del dispositivo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
    </Form>
  );
}
