"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createProvider } from "@/server/actions/providers";
import { ProviderForm } from "@/components/providers/provider-form";
import { Card, CardContent } from "@/components/ui/card";
import type { CreateProviderInput } from "@/lib/validators/provider";

export function CreateProviderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateProviderInput) => createProvider(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Proveedor creado correctamente");
        queryClient.invalidateQueries({ queryKey: ["providers"] });
        router.push("/providers");
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al crear el proveedor");
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <ProviderForm
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </CardContent>
    </Card>
  );
}
