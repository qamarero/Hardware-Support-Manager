"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { IncidentForm } from "@/components/incidents/incident-form";
import { createIncident, fetchUsersForSelect } from "@/server/actions/incidents";
import type { CreateIncidentInput } from "@/lib/validators/incident";

export function CreateIncidentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateIncidentInput) => createIncident(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Incidencia creada correctamente");
        queryClient.invalidateQueries({ queryKey: ["incidents"] });
        router.push("/incidents");
      } else {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Error al crear la incidencia");
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <IncidentForm
          users={users}
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </CardContent>
    </Card>
  );
}
