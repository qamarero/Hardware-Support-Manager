"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserForm } from "@/components/users/user-form";
import { createUser } from "@/server/actions/users";
import type { CreateUserInput } from "@/lib/validators/user";

export function CreateUserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateUserInput) => createUser(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Usuario creado correctamente");
        queryClient.invalidateQueries({ queryKey: ["users"] });
        router.push("/users");
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al crear el usuario");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo Usuario</CardTitle>
      </CardHeader>
      <CardContent>
        <UserForm
          mode="create"
          onSubmit={(data) => mutation.mutate(data as CreateUserInput)}
          isSubmitting={mutation.isPending}
        />
      </CardContent>
    </Card>
  );
}
