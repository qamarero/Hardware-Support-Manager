"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { updateProvider } from "@/server/actions/providers";
import { ProviderForm } from "@/components/providers/provider-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ProviderRow } from "@/server/queries/providers";
import type { CreateProviderInput } from "@/lib/validators/provider";

interface ProviderDetailProps {
  provider: ProviderRow;
}

export function ProviderDetail({ provider }: ProviderDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: CreateProviderInput) =>
      updateProvider(provider.id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Proveedor actualizado correctamente");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al actualizar el proveedor");
    },
  });

  if (isEditing) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Editar Proveedor</h1>
        <Card>
          <CardContent className="pt-6">
            <ProviderForm
              defaultValues={{
                name: provider.name,
                email: provider.email ?? "",
                phone: provider.phone ?? "",
                contactPerson: provider.contactPerson ?? "",
                website: provider.website ?? "",
                notes: provider.notes ?? "",
              }}
              onSubmit={(data) => updateMutation.mutate(data)}
              isSubmitting={updateMutation.isPending}
              mode="edit"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{provider.name}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsEditing(true)}>Editar</Button>
          <Button variant="outline" asChild>
            <Link href="/providers">Volver</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informacion del proveedor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre</p>
              <p className="text-sm">{provider.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{provider.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Telefono</p>
              <p className="text-sm">{provider.phone || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Persona de contacto</p>
              <p className="text-sm">{provider.contactPerson || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sitio web</p>
              <p className="text-sm">
                {provider.website ? (
                  <a
                    href={
                      provider.website.startsWith("http")
                        ? provider.website
                        : `https://${provider.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {provider.website}
                  </a>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de creacion</p>
              <p className="text-sm">{formatDate(provider.createdAt)}</p>
            </div>
          </div>
          {provider.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Notas</p>
              <p className="text-sm whitespace-pre-wrap">{provider.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
