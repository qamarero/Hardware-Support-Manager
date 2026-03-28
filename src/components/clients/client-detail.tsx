"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  User,
} from "lucide-react";
import {
  updateClient,
  createClientLocation,
  updateClientLocation,
  deleteClientLocation,
} from "@/server/actions/clients";
import { ClientForm } from "@/components/clients/client-form";
import { ClientLocationForm } from "@/components/clients/client-location-form";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ClientWithLocations, ClientLocationRow } from "@/server/queries/clients";
import type { CreateClientInput, CreateClientLocationInput } from "@/lib/validators/client";

interface ClientDetailProps {
  client: ClientWithLocations;
}

export function ClientDetail({ client }: ClientDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // Location dialog state
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ClientLocationRow | null>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);

  // Update client mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateClientInput) => updateClient(client.id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Cliente actualizado correctamente");
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al actualizar el cliente");
    },
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: (data: CreateClientLocationInput) => createClientLocation(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Local añadido correctamente");
        setLocationDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al añadir el local");
    },
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateClientLocationInput }) =>
      updateClientLocation(id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Local actualizado correctamente");
        setLocationDialogOpen(false);
        setEditingLocation(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al actualizar el local");
    },
  });

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: (id: string) => deleteClientLocation(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Local eliminado correctamente");
        setDeleteLocationId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al eliminar el local");
      setDeleteLocationId(null);
    },
  });

  function handleOpenAddLocation() {
    setEditingLocation(null);
    setLocationDialogOpen(true);
  }

  function handleOpenEditLocation(location: ClientLocationRow) {
    setEditingLocation(location);
    setLocationDialogOpen(true);
  }

  function handleLocationDialogOpenChange(open: boolean) {
    if (!open) {
      setEditingLocation(null);
    }
    setLocationDialogOpen(open);
  }

  function handleLocationSubmit(data: CreateClientLocationInput) {
    if (editingLocation) {
      updateLocationMutation.mutate({ id: editingLocation.id, data });
    } else {
      createLocationMutation.mutate(data);
    }
  }

  const isLocationSubmitting =
    createLocationMutation.isPending || updateLocationMutation.isPending;

  if (isEditing) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Editar Cliente</h1>
        <Card>
          <CardContent className="pt-6">
            <ClientForm
              defaultValues={{
                name: client.name,
                externalId: client.externalId ?? "",
                intercomUrl: client.intercomUrl ?? "",
                email: client.email ?? "",
                phone: client.phone ?? "",
                contactName: client.contactName ?? "",
                address: client.address ?? "",
                city: client.city ?? "",
                postalCode: client.postalCode ?? "",
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{client.name}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsEditing(true)}>Editar</Button>
          <Button variant="outline" asChild>
            <Link href="/clients">Volver</Link>
          </Button>
        </div>
      </div>

      {/* Client info card */}
      <Card>
        <CardHeader>
          <CardTitle>Informacion del cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Empresa</p>
              <p className="text-sm">{client.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">ID Externo</p>
              <p className="text-sm">{client.externalId || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {client.email}
                  </a>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Telefono</p>
              <p className="text-sm">
                {client.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {client.phone}
                  </span>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contacto</p>
              <p className="text-sm">
                {client.contactName ? (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {client.contactName}
                  </span>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Dirección</p>
              <p className="text-sm">
                {client.address || client.city || client.postalCode ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[client.address, client.postalCode, client.city].filter(Boolean).join(", ") || "-"}
                  </span>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">URL Intercom</p>
              <p className="text-sm">
                {client.intercomUrl ? (
                  <a
                    href={
                      client.intercomUrl.startsWith("http")
                        ? client.intercomUrl
                        : `https://${client.intercomUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {client.intercomUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de creacion</p>
              <p className="text-sm">{formatDate(client.createdAt)}</p>
            </div>
          </div>
          {client.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Notas</p>
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Locations section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Locales ({client.locations.length})
            </CardTitle>
            <Button size="sm" onClick={handleOpenAddLocation}>
              <Plus className="mr-1 h-4 w-4" />
              Anadir Local
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {client.locations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay locales registrados
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {client.locations.map((location) => (
                <div
                  key={location.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  {/* Location header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{location.name}</span>
                      {location.isDefault && (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <Star className="h-3 w-3" />
                          Defecto
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpenEditLocation(location)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar local</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteLocationId(location.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar local</span>
                      </Button>
                    </div>
                  </div>

                  {/* Contact info */}
                  {location.contactName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span>{location.contactName}</span>
                    </div>
                  )}
                  {location.contactEmail && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <a
                        href={`mailto:${location.contactEmail}`}
                        className="hover:underline truncate"
                      >
                        {location.contactEmail}
                      </a>
                    </div>
                  )}
                  {location.contactPhone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{location.contactPhone}</span>
                    </div>
                  )}

                  {/* Address */}
                  {(location.address || location.city || location.postalCode) && (
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {location.address && (
                        <p>{location.address}</p>
                      )}
                      {(location.city || location.postalCode) && (
                        <p>
                          {[location.postalCode, location.city]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {location.notes && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2">
                      {location.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location form dialog */}
      <ClientLocationForm
        clientId={client.id}
        defaultValues={
          editingLocation
            ? {
                clientId: client.id,
                name: editingLocation.name,
                contactName: editingLocation.contactName ?? "",
                contactEmail: editingLocation.contactEmail ?? "",
                contactPhone: editingLocation.contactPhone ?? "",
                address: editingLocation.address ?? "",
                city: editingLocation.city ?? "",
                postalCode: editingLocation.postalCode ?? "",
                notes: editingLocation.notes ?? "",
                isDefault: editingLocation.isDefault ?? false,
              }
            : undefined
        }
        onSubmit={handleLocationSubmit}
        isSubmitting={isLocationSubmitting}
        mode={editingLocation ? "edit" : "create"}
        open={locationDialogOpen}
        onOpenChange={handleLocationDialogOpenChange}
      />

      {/* Delete location dialog */}
      <ConfirmDeleteDialog
        open={deleteLocationId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteLocationId(null);
        }}
        title="Eliminar local"
        description="Esta accion no se puede deshacer. El local sera eliminado permanentemente."
        onConfirm={() => {
          if (deleteLocationId) deleteLocationMutation.mutate(deleteLocationId);
        }}
        isLoading={deleteLocationMutation.isPending}
      />
    </div>
  );
}
