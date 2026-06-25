"use client";

import Link from "next/link";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  createProviderSchema,
  type CreateProviderInput,
} from "@/lib/validators/provider";

interface ProviderFormProps {
  defaultValues?: Partial<CreateProviderInput>;
  onSubmit: (data: CreateProviderInput) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function ProviderForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: ProviderFormProps) {
  const form = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      website: defaultValues?.website ?? "",
      rmaUrl: defaultValues?.rmaUrl ?? "",
      contacts: defaultValues?.contacts ?? [],
      notes: defaultValues?.notes ?? "",
      rmaProcess: {
        method: defaultValues?.rmaProcess?.method ?? "",
        emailTo: defaultValues?.rmaProcess?.emailTo ?? "",
        emailCc: defaultValues?.rmaProcess?.emailCc ?? "",
        requiresForm: defaultValues?.rmaProcess?.requiresForm ?? false,
        formType: defaultValues?.rmaProcess?.formType ?? "",
        formUrl: defaultValues?.rmaProcess?.formUrl ?? "",
        allowsDirectToClient: defaultValues?.rmaProcess?.allowsDirectToClient ?? false,
        steps: defaultValues?.rmaProcess?.steps ?? "",
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "contacts",
  });

  const requiresForm = form.watch("rmaProcess.requiresForm");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Seccion 1: Informacion General */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Informacion general</h3>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del proveedor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email SAT</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="sat@proveedor.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sitio web</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Seccion 2: Proceso RMA */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Proceso RMA</h3>
          <p className="text-sm text-muted-foreground">
            Cómo se tramita un RMA con este proveedor. Se mostrará al crear/gestionar el RMA.
          </p>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="rmaProcess.method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cómo se abre el RMA</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecciona método" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">Solo email</SelectItem>
                      <SelectItem value="portal">Solo portal web</SelectItem>
                      <SelectItem value="portal_y_email">Portal + email de aviso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rmaUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Portal / Ticket RMA</FormLabel>
                  <FormControl>
                    <Input placeholder="https://portal.proveedor.com/rma" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rmaProcess.emailTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email RMA (destino)</FormLabel>
                  <FormControl>
                    <Input placeholder="sat@proveedor.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rmaProcess.emailCc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email CC</FormLabel>
                  <FormControl>
                    <Input placeholder="hardware@qamarero.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="rmaProcess.requiresForm"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">Requiere rellenar un formulario / PDF</FormLabel>
              </FormItem>
            )}
          />

          {requiresForm && (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="rmaProcess.formType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de formulario</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Web o PDF" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="web">Formulario web</SelectItem>
                        <SelectItem value="pdf">PDF a rellenar</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rmaProcess.formUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enlace al formulario / plantilla PDF</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <FormField
            control={form.control}
            name="rmaProcess.allowsDirectToClient"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">Permite recogida/envío directo al cliente</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rmaProcess.steps"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pasos / notas del procedimiento</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="Ej: 1) Enviar email a sat@... 2) Aprueban y envían PDF con el nº de RMA 3) ..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Seccion 3: Contactos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Contactos</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: "", email: "", phone: "", role: "" })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Añadir contacto
            </Button>
          </div>
          <Separator />

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay contactos registrados
            </p>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid flex-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`contacts.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre *</FormLabel>
                              <FormControl>
                                <Input placeholder="Nombre del contacto" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`contacts.${index}.email`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="contacto@proveedor.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`contacts.${index}.phone`}
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
                        <FormField
                          control={form.control}
                          name={`contacts.${index}.role`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rol</FormLabel>
                              <FormControl>
                                <Input placeholder="Tecnico, SAT, Comercial..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Eliminar contacto</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Seccion 4: Notas */}
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
                    placeholder="Notas adicionales sobre el proveedor"
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
                ? "Crear Proveedor"
                : "Guardar Cambios"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/providers">Cancelar</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
