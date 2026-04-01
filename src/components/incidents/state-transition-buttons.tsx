"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransitionDialog } from "@/components/shared/transition-dialog";
import { ForceTransitionButton } from "@/components/shared/force-transition-button";
import { transitionIncident, forceTransitionIncident } from "@/server/actions/incidents";
import { getAvailableTransitions } from "@/lib/state-machines/incident";
import { INCIDENT_STATUS_LABELS, type IncidentStatus } from "@/lib/constants/incidents";
import type { UserRole } from "@/lib/constants/roles";
import type { StateTransition } from "@/lib/state-machines/incident";

interface StateTransitionButtonsProps {
  incidentId: string;
  currentStatus: IncidentStatus;
  onTransitionComplete: () => void;
}

export function StateTransitionButtons({
  incidentId,
  currentStatus,
  onTransitionComplete,
}: StateTransitionButtonsProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedTransition, setSelectedTransition] =
    useState<StateTransition | null>(null);

  const userRole = (session?.user?.role ?? "viewer") as UserRole;
  const transitions = getAvailableTransitions(currentStatus, userRole);

  const mutation = useMutation({
    mutationFn: (vars: {
      toStatus: string;
      comment?: string;
      resolutionType?: "standard" | "derivado_rma";
    }) =>
      transitionIncident({
        incidentId,
        toStatus: vars.toStatus,
        comment: vars.comment,
        resolutionType: vars.resolutionType,
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Estado actualizado");
        queryClient.invalidateQueries({
          queryKey: ["event-logs", "incident", incidentId],
        });
        onTransitionComplete();

        if (selectedTransition?.resolutionType === "derivado_rma") {
          router.push(`/rmas/new?incidentId=${incidentId}`);
        }
      } else {
        toast.error(result.error);
      }
      setSelectedTransition(null);
    },
    onError: () => {
      toast.error("Error al cambiar el estado");
      setSelectedTransition(null);
    },
  });

  const isAdmin = userRole === "admin";
  const incidentStatuses = Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

  if (transitions.length === 0 && !isAdmin) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {transitions.map((t) => {
          const isRma = t.resolutionType === "derivado_rma";
          const isCancelado = t.to === "cancelado";

          return (
            <Button
              key={`${t.from}-${t.to}-${t.resolutionType ?? ""}`}
              variant={isCancelado ? "destructive" : isRma ? "outline" : "default"}
              size="sm"
              onClick={() => setSelectedTransition(t)}
            >
              {isRma && <RotateCcw className="mr-2 h-4 w-4" />}
              {t.label}
            </Button>
          );
        })}
        {isAdmin && (
          <ForceTransitionButton
            entityId={incidentId}
            entityType="incident"
            currentStatus={currentStatus}
            statuses={incidentStatuses}
            onForceTransition={forceTransitionIncident}
            onComplete={onTransitionComplete}
          />
        )}
      </div>

      <TransitionDialog
        open={!!selectedTransition}
        onConfirm={(comment) =>
          selectedTransition &&
          mutation.mutate({
            toStatus: selectedTransition.to,
            comment,
            resolutionType: selectedTransition.resolutionType,
          })
        }
        onCancel={() => setSelectedTransition(null)}
        transitionLabel={selectedTransition?.label ?? ""}
        isPending={mutation.isPending}
      />
    </>
  );
}
