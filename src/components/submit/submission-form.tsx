"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Paperclip, X } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  createSubmissionSchema,
  type CreateSubmissionInput,
} from "@/lib/validators/support-submission";
import { submitSupportRequest } from "@/server/actions/support-submissions";
import { ALLOWED_SUBMITTER_DOMAINS, SUBMIT_IMAGE_TYPES, SUBMIT_MAX_IMAGE_SIZE, SUBMIT_MAX_ATTACHMENTS } from "@/lib/constants/support-submissions";
import { DEVICE_TYPES, DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import { SubmissionSuccess } from "./submission-success";

export function SubmissionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const form = useForm<CreateSubmissionInput>({
    resolver: zodResolver(createSubmissionSchema),
    mode: "onTouched",
    defaultValues: {
      submitterName: "",
      submitterEmail: "",
      clientName: "",
      title: "",
      description: "",
      priority: "media",
      deviceType: "",
      deviceBrand: "",
      deviceModel: "",
      deviceSerialNumber: "",
      contactPhone: "",
      intercomUrl: "",
      attachments: [],
      website: "", // honeypot
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateSubmissionInput) => submitSupportRequest(data),
    onSuccess: (result) => {
      if (result.success) {
        setSubmitted(true);
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al enviar el formulario. Intenta de nuevo.");
    },
  });

  const photos = form.watch("attachments") ?? [];

  async function handlePhotos(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    const current = form.getValues("attachments") ?? [];
    if (current.length + files.length > SUBMIT_MAX_ATTACHMENTS) {
      toast.error(`Máximo ${SUBMIT_MAX_ATTACHMENTS} fotos`);
      return;
    }
    setUploadingPhotos(true);
    const added: { url: string; name: string; size: number; type: string }[] = [];
    try {
      for (const file of files) {
        if (!(SUBMIT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
          toast.error(`${file.name}: solo se permiten imágenes`);
          continue;
        }
        if (file.size > SUBMIT_MAX_IMAGE_SIZE) {
          toast.error(`${file.name}: excede ${Math.round(SUBMIT_MAX_IMAGE_SIZE / (1024 * 1024))} MB`);
          continue;
        }
        try {
          const blob = await upload(`submissions/${Date.now()}-${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/submit-upload/sign",
            contentType: file.type || undefined,
          });
          added.push({ url: blob.url, name: file.name, size: file.size, type: file.type });
        } catch (err) {
          console.error("[submit] error al subir foto:", err);
          const msg = err instanceof Error && err.message ? err.message : "error al subir";
          toast.error(`${file.name}: ${msg}`);
        }
      }
    } finally {
      setUploadingPhotos(false);
    }
    if (added.length) {
      form.setValue("attachments", [...current, ...added], { shouldValidate: true });
    }
  }

  function removePhoto(url: string) {
    const current = form.getValues("attachments") ?? [];
    form.setValue(
      "attachments",
      current.filter((p) => p.url !== url),
      { shouldValidate: true }
    );
  }

  if (submitted) {
    return <SubmissionSuccess onReset={() => { form.reset(); setSubmitted(false); }} />;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-6"
          >
            {/* Honeypot field — hidden from humans, bots fill it */}
            <div className="hidden" aria-hidden="true">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <Input
                    {...field}
                    tabIndex={-1}
                    autoComplete="off"
                    placeholder="Website"
                  />
                )}
              />
            </div>

            {/* Quién eres */}
            <div>
              <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                <span className="h-4 w-1 rounded-full bg-primary" />
                Quién eres
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <FormField
                  control={form.control}
                  name="submitterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tu nombre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="submitterEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tu email Qamarero *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={`tu@${ALLOWED_SUBMITTER_DOMAINS[0]}`} {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Solo emails {ALLOWED_SUBMITTER_DOMAINS.map(d => `@${d}`).join(" o ")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Cliente afectado */}
            <div>
              <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                <span className="h-4 w-1 rounded-full bg-primary" />
                Cliente afectado
              </h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del cliente / empresa *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Restaurante Berraco" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Intentaremos matchear automaticamente con los clientes registrados
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="intercomUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de la conversación Intercom</FormLabel>
                      <FormControl>
                        <Input placeholder="https://app.intercom.com/..." {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Opcional — si la tienes pégala; si no, se puede añadir después
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Problema */}
            <div>
              <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                <span className="h-4 w-1 rounded-full bg-primary" />
                Problema reportado
              </h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título breve *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: TPV no enciende en Restaurante Berraco" {...field} />
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
                      <FormLabel>Descripción detallada *</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={5}
                          placeholder="Describe el problema con el mayor detalle posible: síntomas, cuándo empezó, qué se ha probado..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridad *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar prioridad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="media">Cliente puede operar</SelectItem>
                          <SelectItem value="critica">Cliente no puede operar — urge</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Dispositivo */}
            <div>
              <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                <span className="h-4 w-1 rounded-full bg-primary" />
                Dispositivo (opcional)
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <FormField
                  control={form.control}
                  name="deviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de dispositivo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEVICE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {DEVICE_TYPE_LABELS[type as DeviceType] ?? type}
                            </SelectItem>
                          ))}
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
                        <Input placeholder="Ej: Sunmi, Jassway, Epson..." {...field} />
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
                        <Input placeholder="Ej: T2, JWS-360..." {...field} />
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
                        <Input placeholder="Si lo tienes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Contacto */}
            <div>
              <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                <span className="h-4 w-1 rounded-full bg-primary" />
                Contacto del cliente
              </h3>
              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono de contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="+34 612 345 678" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Opcional — si es necesario contactar al cliente para el seguimiento
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator className="bg-border/40" />

            {/* Fotos del problema */}
            <div>
              <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                <span className="h-4 w-1 rounded-full bg-primary" />
                Fotos del problema (opcional)
              </h3>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Una imagen ayuda muchísimo: foto del equipo, del error en pantalla, del cableado…
                  (máx {SUBMIT_MAX_ATTACHMENTS}, {Math.round(SUBMIT_MAX_IMAGE_SIZE / (1024 * 1024))} MB cada una)
                </p>
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {photos.map((p) => (
                      <div key={p.url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.name} className="h-20 w-20 rounded-lg border object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(p.url)}
                          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                          aria-label={`Quitar ${p.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  id="submit-photo-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { handlePhotos(e.target.files); e.target.value = ""; }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingPhotos || photos.length >= SUBMIT_MAX_ATTACHMENTS}
                  onClick={() => document.getElementById("submit-photo-input")?.click()}
                >
                  {uploadingPhotos ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="mr-2 h-4 w-4" />
                  )}
                  Añadir fotos
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button type="submit" disabled={mutation.isPending} size="lg">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar formulario
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
