"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { ClientForm } from "@/components/clients/client-form";
import { createClient } from "@/server/actions/clients";
import type { CreateClientInput } from "@/lib/validators/client";

export function CreateClientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateClientInput) => createClient(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Cliente creado correctamente");
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        router.push("/clients");
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al crear el cliente");
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <ClientForm
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </CardContent>
    </Card>
  );
}
