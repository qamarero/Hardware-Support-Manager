"use client";

import { useRef } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { VariableInserter } from "@/components/message-templates/variable-inserter";
import {
  messageTemplateFormSchema,
  type MessageTemplateFormInput,
} from "@/lib/validators/message-template";
import { TEMPLATE_CATEGORY_LABELS } from "@/lib/constants/message-templates";

interface TemplateFormProps {
  defaultValues?: Partial<MessageTemplateFormInput>;
  onSubmit: (data: MessageTemplateFormInput) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function TemplateForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: TemplateFormProps) {
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<MessageTemplateFormInput>({
    resolver: zodResolver(messageTemplateFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      category: defaultValues?.category ?? "cliente",
      subject: defaultValues?.subject ?? "",
      body: defaultValues?.body ?? "",
      variables: defaultValues?.variables ?? [],
      sortOrder: defaultValues?.sortOrder ?? 0,
      isActive: defaultValues?.isActive ?? true,
    },
  });

  /** Extract {{variable}} names from body+subject and sync to form */
  const syncVariables = (body: string, subject: string) => {
    const regex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match: RegExpExecArray | null;
    const combined = `${subject} ${body}`;
    while ((match = regex.exec(combined)) !== null) {
      vars.add(match[1]);
    }
    form.setValue("variables", Array.from(vars));
  };

  const insertVariable = (variable: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const current = form.getValues("body");
    const newValue =
      current.substring(0, start) + variable + current.substring(end);
    form.setValue("body", newValue);
    syncVariables(newValue, form.getValues("subject") ?? "");

    // Restore focus and cursor
    setTimeout(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* General */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Solicitud RMA a proveedor" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(TEMPLATE_CATEGORY_LABELS).map(
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

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Orden</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>Menor = aparece primero</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Activa</FormLabel>
                  <FormDescription>
                    Las plantillas inactivas no aparecen en el selector
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
        </div>

        <Separator />

        {/* Content */}
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asunto</FormLabel>
              <FormControl>
                <Input
                  placeholder="Asunto del mensaje (soporta {{variables}})"
                  {...field}
                  ref={(el) => {
                    field.ref(el);
                    subjectRef.current = el;
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                    syncVariables(form.getValues("body"), e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FormLabel>Cuerpo del mensaje *</FormLabel>
            <VariableInserter onInsert={insertVariable} category={form.watch("category")} />
          </div>
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Escriba el texto del mensaje. Use {{variable}} para valores dinámicos."
                    rows={12}
                    className="font-mono text-sm"
                    {...field}
                    ref={(el) => {
                      field.ref(el);
                      bodyRef.current = el;
                    }}
                    onChange={(e) => {
                      field.onChange(e);
                      syncVariables(e.target.value, form.getValues("subject") ?? "");
                    }}
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
                ? "Crear Plantilla"
                : "Guardar Cambios"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings/templates">Cancelar</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
