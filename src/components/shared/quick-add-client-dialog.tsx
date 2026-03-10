"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { quickCreateClientSchema, type QuickCreateClientInput } from "@/lib/validators/client";
import { quickCreateClient } from "@/server/actions/clients";

interface QuickAddClientDialogProps {
  onClientCreated: (client: { id: string; name: string }) => void;
}

export function QuickAddClientDialog({ onClientCreated }: QuickAddClientDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<QuickCreateClientInput>({
    resolver: zodResolver(quickCreateClientSchema),
    defaultValues: {
      clientCode: "",
      name: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: QuickCreateClientInput) => quickCreateClient(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Cliente creado");
        onClientCreated(result.data);
        setOpen(false);
        form.reset();
      } else {
        form.setError("clientCode", { message: result.error });
      }
    },
    onError: () => {
      toast.error("Error al crear cliente");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(); }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-primary"
        >
          <Plus className="h-4 w-4" />
          Añadir cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="clientCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID de cliente *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: CLI-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del local *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del establecimiento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creando..." : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
