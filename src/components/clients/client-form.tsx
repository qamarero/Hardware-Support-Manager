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
  createClientSchema,
  type CreateClientInput,
} from "@/lib/validators/client";

interface ClientFormProps {
  defaultValues?: Partial<CreateClientInput>;
  onSubmit: (data: CreateClientInput) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function ClientForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: ClientFormProps) {
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      externalId: defaultValues?.externalId ?? "",
      intercomUrl: defaultValues?.intercomUrl ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      contactName: defaultValues?.contactName ?? "",
      address: defaultValues?.address ?? "",
      city: defaultValues?.city ?? "",
      postalCode: defaultValues?.postalCode ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Seccion 1: Informacion General */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Informacion general</h3>
          <Separator />

          {/* Empresa - full width */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa *</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre de la empresa" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* externalId + intercomUrl - 2-col grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="externalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Externo</FormLabel>
                  <FormControl>
                    <Input placeholder="Identificador externo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
          </div>

          {/* email + phone - 2-col grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contacto@empresa.com" {...field} />
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
                    <Input placeholder="+34 600 000 000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Seccion 2: Contacto y Dirección */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Contacto y Dirección</h3>
          <Separator />

          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del contacto</FormLabel>
                <FormControl>
                  <Input placeholder="Persona de contacto en el cliente" {...field} />
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
                  <Input placeholder="Calle, número, piso..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
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
                  <FormLabel>Código postal</FormLabel>
                  <FormControl>
                    <Input placeholder="28001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Seccion 3: Notas */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Notas</h3>
          <Separator />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Notas adicionales sobre el cliente"
                    rows={3}
                    {...field}
                  />
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
                ? "Crear Cliente"
                : "Guardar Cambios"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/clients">Cancelar</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
