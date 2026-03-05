"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserForm } from "@/components/users/user-form";
import { updateUser } from "@/server/actions/users";
import { USER_ROLE_LABELS } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils";
import type { UserRow } from "@/server/queries/users";
import type { UpdateUserInput } from "@/lib/validators/user";

interface UserDetailProps {
  user: UserRow;
}

export function UserDetail({ user }: UserDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: UpdateUserInput) => updateUser(user.id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Usuario actualizado correctamente");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al actualizar el usuario");
    },
  });

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Editar Usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <UserForm
            mode="edit"
            defaultValues={{
              name: user.name,
              email: user.email,
              role: user.role as "admin" | "technician" | "viewer",
              active: user.active,
            }}
            onSubmit={(data) => {
              const updateData = { ...data } as UpdateUserInput;
              // Remove empty password so the server doesn't try to hash it
              if (!updateData.password) {
                delete updateData.password;
              }
              mutation.mutate(updateData);
            }}
            isSubmitting={mutation.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Detalle del Usuario</CardTitle>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsEditing(true)}>Editar</Button>
          <Button variant="outline" asChild>
            <Link href="/users">Volver</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Nombre
            </dt>
            <dd className="mt-1 text-sm">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Email
            </dt>
            <dd className="mt-1 text-sm">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Rol</dt>
            <dd className="mt-1 text-sm">
              {USER_ROLE_LABELS[user.role as keyof typeof USER_ROLE_LABELS] ??
                user.role}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Estado
            </dt>
            <dd className="mt-1">
              {user.active ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Activo
                </Badge>
              ) : (
                <Badge variant="secondary">Inactivo</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Creado
            </dt>
            <dd className="mt-1 text-sm">{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Actualizado
            </dt>
            <dd className="mt-1 text-sm">{formatDate(user.updatedAt)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
