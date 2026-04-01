"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TransitionDialog } from "@/components/shared/transition-dialog";
import { ForceTransitionButton } from "@/components/shared/force-transition-button";
import { transitionRma, forceTransitionRma } from "@/server/actions/rmas";
import { getRmaAvailableTransitions } from "@/lib/state-machines/rma";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import type { UserRole } from "@/lib/constants/roles";
import type { RmaStateTransition } from "@/lib/state-machines/rma";

interface RmaTransitionButtonsProps {
  rmaId: string;
  currentStatus: RmaStatus;
  onTransitionComplete: () => void;
}

export function RmaTransitionButtons({
  rmaId,
  currentStatus,
  onTransitionComplete,
}: RmaTransitionButtonsProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedTransition, setSelectedTransition] =
    useState<RmaStateTransition | null>(null);

  const userRole = (session?.user?.role ?? "viewer") as UserRole;
  const transitions = getRmaAvailableTransitions(currentStatus, userRole);

  const mutation = useMutation({
    mutationFn: (vars: { toStatus: string; comment?: string }) =>
      transitionRma({
        rmaId,
        toStatus: vars.toStatus,
        comment: vars.comment,
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Estado actualizado");
        queryClient.invalidateQueries({
          queryKey: ["event-logs", "rma", rmaId],
        });
        onTransitionComplete();
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
  const rmaStatuses = Object.entries(RMA_STATUS_LABELS).map(([value, label]) => ({ value, label }));

  if (transitions.length === 0 && !isAdmin) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {transitions.map((t) => (
          <Button
            key={`${t.from}-${t.to}`}
            variant={t.to === "cancelado" ? "destructive" : "default"}
            size="sm"
            onClick={() => setSelectedTransition(t)}
          >
            {t.label}
          </Button>
        ))}
        {isAdmin && (
          <ForceTransitionButton
            entityId={rmaId}
            entityType="rma"
            currentStatus={currentStatus}
            statuses={rmaStatuses}
            onForceTransition={forceTransitionRma}
            onComplete={onTransitionComplete}
          />
        )}
      </div>

      <TransitionDialog
        open={!!selectedTransition}
        onConfirm={(comment) =>
          selectedTransition &&
          mutation.mutate({ toStatus: selectedTransition.to, comment })
        }
        onCancel={() => setSelectedTransition(null)}
        transitionLabel={selectedTransition?.label ?? ""}
        isPending={mutation.isPending}
      />
    </>
  );
}
