"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface StatusOption {
  value: string;
  label: string;
}

interface ForceTransitionButtonProps {
  entityId: string;
  entityType: "incident" | "rma";
  currentStatus: string;
  statuses: StatusOption[];
  onForceTransition: (input: unknown) => Promise<{ success: boolean; error?: string; data?: unknown }>;
  onComplete: () => void;
}

export function ForceTransitionButton({
  entityId,
  entityType,
  currentStatus,
  statuses,
  onForceTransition,
  onComplete,
}: ForceTransitionButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (toStatus: string) => {
      const idKey = entityType === "incident" ? "incidentId" : "rmaId";
      return onForceTransition({
        [idKey]: entityId,
        toStatus,
        comment: comment.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Estado forzado correctamente", {
          description: "Transición administrativa aplicada",
        });
        queryClient.invalidateQueries({
          queryKey: ["event-logs", entityType, entityId],
        });
        setOpen(false);
        setSelectedStatus(null);
        setComment("");
        onComplete();
      } else {
        toast.error(result.error ?? "Error al forzar transición");
      }
    },
    onError: () => {
      toast.error("Error al forzar transición");
    },
  });

  const availableStatuses = statuses.filter((s) => s.value !== currentStatus);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-full p-0 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/60 dark:text-amber-400 dark:border-amber-500/30 dark:hover:bg-amber-500/15"
          title="Forzar estado (Admin)"
        >
          <Shield className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[90vw] max-w-xs sm:w-72 p-0"
        align="start"
        side="bottom"
        style={{ animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Forzar Estado</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Saltar a cualquier estado sin validar el flujo normal. Solo administradores.
          </p>

          {/* Status grid */}
          {!selectedStatus ? (
            <div className="grid grid-cols-2 gap-1.5">
              {availableStatuses.map((s, i) => (
                <button
                  key={s.value}
                  type="button"
                  className="rounded-lg border border-border/50 px-2.5 py-2 text-xs font-medium text-left transition-all duration-150 hover:bg-primary/5 hover:border-primary/30 hover:text-primary"
                  style={{ animation: `fadeInUp 200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 40}ms both` }}
                  onClick={() => setSelectedStatus(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <div
              className="space-y-3"
              style={{ animation: "fadeInUp 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
            >
              {/* Selected status */}
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  → {statuses.find((s) => s.value === selectedStatus)?.label}
                </span>
              </div>

              {/* Comment */}
              <div className="space-y-1.5">
                <Label className="text-xs">Motivo del cambio</Label>
                <Textarea
                  placeholder="Describir por qué se fuerza este cambio..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={() => {
                    setSelectedStatus(null);
                    setComment("");
                  }}
                  disabled={mutation.isPending}
                >
                  Volver
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => selectedStatus && mutation.mutate(selectedStatus)}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
