"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientForm } from "@/components/clients/client-form";
import { updateClient } from "@/server/actions/clients";
import { formatDate } from "@/lib/utils";
import type { ClientRow } from "@/server/queries/clients";
import type { CreateClientInput } from "@/lib/validators/client";

interface ClientDetailProps {
  client: ClientRow;
}

export function ClientDetail({ client }: ClientDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: CreateClientInput) => updateClient(client.id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Cliente actualizado correctamente");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al actualizar el cliente");
    },
  });

  if (isEditing) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Editar Cliente</h1>
        <Card>
          <CardContent className="pt-6">
            <ClientForm
              defaultValues={{
                name: client.name,
                email: client.email ?? "",
                phone: client.phone ?? "",
                company: client.company ?? "",
                address: client.address ?? "",
                clientPnp: client.clientPnp ?? false,
                notes: client.notes ?? "",
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
        <h1 className="text-3xl font-bold">{client.name}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsEditing(true)}>Editar</Button>
          <Button variant="outline" asChild>
            <Link href="/clients">Volver</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Nombre
              </dt>
              <dd className="mt-1 text-sm">{client.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1 text-sm">{client.email || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Teléfono
              </dt>
              <dd className="mt-1 text-sm">{client.phone || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Empresa
              </dt>
              <dd className="mt-1 text-sm">{client.company || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Cliente PNP
              </dt>
              <dd className="mt-1 text-sm">{client.clientPnp ? "Sí" : "No"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground">
                Dirección
              </dt>
              <dd className="mt-1 text-sm">{client.address || "-"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground">
                Notas
              </dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap">
                {client.notes || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Fecha de creación
              </dt>
              <dd className="mt-1 text-sm">{formatDate(client.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Última actualización
              </dt>
              <dd className="mt-1 text-sm">{formatDate(client.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
