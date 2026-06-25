"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Mail, Phone, User } from "lucide-react";
import { updateProvider } from "@/server/actions/providers";
import { ProviderForm } from "@/components/providers/provider-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ProviderRow } from "@/server/queries/providers";
import type { CreateProviderInput } from "@/lib/validators/provider";
import type { ProviderContact } from "@/types";

const RMA_METHOD_LABELS: Record<string, string> = {
  email: "Solo email",
  portal: "Solo portal web",
  portal_y_email: "Portal + email de aviso",
};

interface ProviderDetailProps {
  provider: ProviderRow;
}

export function ProviderDetail({ provider }: ProviderDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const contacts = (provider.contacts ?? []) as ProviderContact[];

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
                website: provider.website ?? "",
                rmaUrl: provider.rmaUrl ?? "",
                contacts: contacts,
                notes: provider.notes ?? "",
                rmaProcess: provider.rmaProcess ?? {},
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
              <p className="text-sm font-medium text-muted-foreground">Email SAT</p>
              <p className="text-sm">{provider.email || "-"}</p>
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
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {provider.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Portal RMA</p>
              <p className="text-sm">
                {provider.rmaUrl ? (
                  <a
                    href={
                      provider.rmaUrl.startsWith("http")
                        ? provider.rmaUrl
                        : `https://${provider.rmaUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {provider.rmaUrl}
                    <ExternalLink className="h-3 w-3" />
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

      {provider.rmaProcess && Object.keys(provider.rmaProcess).some((k) => {
        const v = (provider.rmaProcess as Record<string, unknown>)[k];
        return v !== "" && v !== false && v != null;
      }) && (
        <Card>
          <CardHeader>
            <CardTitle>Procedimiento RMA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {provider.rmaProcess.method && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cómo se abre</p>
                  <p className="text-sm">{RMA_METHOD_LABELS[provider.rmaProcess.method] ?? provider.rmaProcess.method}</p>
                </div>
              )}
              {provider.rmaProcess.emailTo && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email RMA</p>
                  <p className="text-sm">
                    {provider.rmaProcess.emailTo}
                    {provider.rmaProcess.emailCc ? ` · cc: ${provider.rmaProcess.emailCc}` : ""}
                  </p>
                </div>
              )}
              {provider.rmaProcess.requiresForm && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Formulario</p>
                  <p className="text-sm">
                    {provider.rmaProcess.formType === "pdf" ? "PDF a rellenar" : "Formulario web"}
                    {provider.rmaProcess.formUrl ? (
                      <>
                        {" · "}
                        <a
                          href={provider.rmaProcess.formUrl.startsWith("http") ? provider.rmaProcess.formUrl : `https://${provider.rmaProcess.formUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Envío directo al cliente</p>
                <p className="text-sm">
                  {provider.rmaProcess.allowsDirectToClient ? "Permitido" : "No (recogemos y enviamos nosotros)"}
                </p>
              </div>
            </div>
            {provider.rmaProcess.steps && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pasos</p>
                <p className="text-sm whitespace-pre-wrap">{provider.rmaProcess.steps}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contactos</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay contactos registrados</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {contacts.map((contact, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{contact.name}</span>
                    </div>
                    {contact.role && (
                      <Badge variant="secondary">{contact.role}</Badge>
                    )}
                  </div>
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <a href={`mailto:${contact.email}`} className="hover:underline">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
