"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { RmaForm } from "@/components/rmas/rma-form";
import { createRma, fetchProvidersForSelect } from "@/server/actions/rmas";
import { fetchIncidentsForSelect } from "@/server/actions/incidents";
import type { RmaFormInput } from "@/lib/validators/rma";

export function CreateRmaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: providers = [] } = useQuery({
    queryKey: ["providers", "select"],
    queryFn: () => fetchProvidersForSelect(),
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", "select"],
    queryFn: () => fetchIncidentsForSelect(),
  });

  const createMutation = useMutation({
    mutationFn: (data: RmaFormInput) => createRma(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("RMA creado correctamente");
        queryClient.invalidateQueries({ queryKey: ["rmas"] });
        router.push("/rmas");
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al crear el RMA");
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <RmaForm
          providers={providers}
          incidents={incidents}
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </CardContent>
    </Card>
  );
}
