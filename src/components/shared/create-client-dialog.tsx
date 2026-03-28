"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createClient,
  createClientLocation,
} from "@/server/actions/clients";

const quickClientSchema = z.object({
  name: z.string().min(1, "El nombre de empresa es obligatorio"),
  locationName: z.string().min(1, "El nombre del local es obligatorio"),
});

type QuickClientFormValues = z.infer<typeof quickClientSchema>;

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: (data: {
    clientId: string;
    clientName: string;
    locationId: string;
  }) => void;
  initialName?: string;
}

export function CreateClientDialog({
  open,
  onOpenChange,
  onClientCreated,
  initialName,
}: CreateClientDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickClientFormValues>({
    resolver: zodResolver(quickClientSchema),
    defaultValues: {
      name: initialName ?? "",
      locationName: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: initialName ?? "",
        locationName: "",
      });
    }
  }, [open, initialName, reset]);

  const onSubmit = async (values: QuickClientFormValues) => {
    const clientResult = await createClient({ name: values.name });

    if (!clientResult.success) {
      toast.error(clientResult.error ?? "Error al crear el cliente");
      return;
    }

    const clientId = clientResult.data.id;

    const locationResult = await createClientLocation({
      clientId,
      name: values.locationName,
    });

    if (!locationResult.success) {
      toast.error(locationResult.error ?? "Error al crear el local");
      return;
    }

    const locationId = locationResult.data.id;

    toast.success(`Cliente "${values.name}" creado correctamente`);
    onClientCreated({ clientId, clientName: values.name, locationId });
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(nextOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear nuevo cliente</DialogTitle>
          <DialogDescription>
            Introduce los datos básicos para registrar el cliente y su local
            principal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Nombre de empresa</Label>
            <Input
              id="client-name"
              placeholder="Ej: Empresa Ejemplo S.L."
              autoComplete="off"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location-name">Nombre del local</Label>
            <Input
              id="location-name"
              placeholder="Ej: Sede Central"
              autoComplete="off"
              {...register("locationName")}
            />
            {errors.locationName && (
              <p className="text-sm text-destructive">
                {errors.locationName.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Crear Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
