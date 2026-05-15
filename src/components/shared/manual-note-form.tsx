"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addManualNote } from "@/server/actions/notes";
import type { EntityType } from "@/lib/constants/attachments";

const MAX_LENGTH = 2000;

interface ManualNoteFormProps {
  entityType: Extract<EntityType, "incident" | "rma">;
  entityId: string;
  intercomConversationId?: string | null;
}

export function ManualNoteForm({
  entityType,
  entityId,
  intercomConversationId,
}: ManualNoteFormProps) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: (noteBody: string) =>
      addManualNote({ entityType, entityId, body: noteBody }),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        intercomConversationId
          ? "Nota añadida y enviada a Intercom"
          : "Nota añadida al historial"
      );
      setBody("");
      queryClient.invalidateQueries({
        queryKey: ["event-logs", entityType, entityId],
      });
      if (intercomConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["intercom-conversation", intercomConversationId],
        });
      } else {
        queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === "intercom-conversation",
        });
      }
    },
    onError: () => {
      toast.error("Error al añadir la nota");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || mutation.isPending) return;
    mutation.mutate(trimmed);
  };

  const hasIntercom = Boolean(intercomConversationId);
  const remaining = MAX_LENGTH - body.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
        placeholder={
          hasIntercom
            ? "Escribe una nota — se publicará también como nota interna en Intercom"
            : "Escribe una nota para el historial"
        }
        rows={3}
        disabled={mutation.isPending}
        className="resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {hasIntercom
            ? "Se publicará como nota interna en Intercom con tu nombre."
            : "Sin conversación de Intercom vinculada — la nota se registrará solo en HSM."}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {remaining}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Añadir nota al historial
          </Button>
        </div>
      </div>
    </form>
  );
}
