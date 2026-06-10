"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { createUserSchema } from "@/lib/validators/user";
import { USER_ROLE_LABELS } from "@/lib/constants/roles";

const userCreateFormSchema = createUserSchema;

const userEditFormSchema = createUserSchema.extend({
  active: z.boolean().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional().or(z.literal("")),
});

type UserFormValues = z.infer<typeof userEditFormSchema>;

interface UserFormProps {
  defaultValues?: Partial<UserFormValues>;
  onSubmit: (data: UserFormValues) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function UserForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: UserFormProps) {
  const isEdit = mode === "edit";
  const formSchema = isEdit ? userEditFormSchema : userCreateFormSchema;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      password: defaultValues?.password ?? "",
      role: defaultValues?.role ?? "technician",
      avatarUrl: defaultValues?.avatarUrl ?? "",
      ...(isEdit ? { active: defaultValues?.active ?? true } : {}),
    },
  });

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarUrl = form.watch("avatarUrl");
  const nameVal = form.watch("name");
  const initials = (nameVal || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El avatar debe ser una imagen");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("La imagen no puede superar 4 MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const blob = await upload(`avatars/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload/sign",
        contentType: file.type || undefined,
      });
      form.setValue("avatarUrl", blob.url, { shouldDirty: true });
      toast.success("Imagen subida");
    } catch {
      toast.error("Error al subir la imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-muted-foreground">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
              {avatarUrl ? "Cambiar imagen" : "Subir imagen"}
            </Button>
            {avatarUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("avatarUrl", "", { shouldDirty: true })}>
                <X className="mr-1 h-4 w-4" /> Quitar
              </Button>
            )}
          </div>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre *</FormLabel>
              <FormControl>
                <Input placeholder="Nombre del usuario" {...field} />
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
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Contraseña {isEdit ? "" : "*"}
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder={
                    isEdit
                      ? "Nueva contraseña (opcional)"
                      : "Mínimo 6 caracteres"
                  }
                  {...field}
                />
              </FormControl>
              {isEdit && (
                <FormDescription>
                  Dejar vacío para mantener la contraseña actual
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEdit && (
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Activo</FormLabel>
                  <FormDescription>
                    Los usuarios inactivos no pueden iniciar sesión
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando..."
              : isEdit
                ? "Guardar Cambios"
                : "Crear Usuario"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/users">Cancelar</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
