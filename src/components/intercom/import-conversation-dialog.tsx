"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importIntercomConversation } from "@/server/actions/intercom-inbox";

interface ImportConversationDialogProps {
  onImported: (inboxItemId: string, alreadyExisted: boolean) => void;
}

export function ImportConversationDialog({ onImported }: ImportConversationDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const mutation = useMutation({
    mutationFn: (input: string) => importIntercomConversation(input),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { inboxItemId, alreadyExisted } = result.data;
      toast.success(
        alreadyExisted
          ? "La conversación ya estaba en la bandeja"
          : "Conversación importada a la bandeja"
      );
      onImported(inboxItemId, alreadyExisted);
      setValue("");
      setOpen(false);
    },
    onError: () => toast.error("Error al importar la conversación"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || mutation.isPending) return;
    mutation.mutate(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          Importar de Intercom
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar conversación de Intercom</DialogTitle>
          <DialogDescription>
            Pega la URL de una conversación de Intercom o el ID numérico. Útil cuando la
            conversación no llegó automáticamente por el webhook.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="intercom-url">URL o ID de conversación</Label>
            <Input
              id="intercom-url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://app.intercom.com/.../conversation/123456"
              disabled={mutation.isPending}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!value.trim() || mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
