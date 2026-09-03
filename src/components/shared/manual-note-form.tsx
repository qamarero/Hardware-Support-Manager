"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addManualNote } from "@/server/actions/notes";
import { createAttachment } from "@/server/actions/attachments";
import {
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  ENTITY_TYPES,
  type EntityType,
} from "@/lib/constants/attachments";

const MAX_LENGTH = 2000;

interface ManualNoteFormProps {
  entityType: Extract<EntityType, "incident" | "rma">;
  entityId: string;
  intercomConversationId?: string | null;
}

/** Fichero pendiente de enviar, con su vista previa local. */
interface Pending {
  file: File;
  preview: string | null;
}

export function ManualNoteForm({
  entityType,
  entityId,
  intercomConversationId,
}: ManualNoteFormProps) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Las vistas previas son object URLs: hay que liberarlas al desmontar.
  useEffect(() => {
    return () => pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (list: FileList | File[] | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    const limitMb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    const accepted: Pending[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: excede ${limitMb} MB`);
        continue;
      }
      if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: tipo no permitido (${file.type || "desconocido"})`);
        continue;
      }
      accepted.push({
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    }
    if (accepted.length > 0) setPending((prev) => [...prev, ...accepted]);
  };

  const removeFile = (index: number) => {
    setPending((prev) => {
      const p = prev[index];
      if (p?.preview) URL.revokeObjectURL(p.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const mutation = useMutation({
    mutationFn: async (noteBody: string) => {
      const result = await addManualNote({ entityType, entityId, body: noteBody });
      if (!result.success) throw new Error(result.error);

      // Los ficheros cuelgan de la ENTRADA del historial, no de la incidencia:
      // así aparecen dentro de su nota, en su sitio de la cronología.
      let uploaded = 0;
      for (const { file } of pending) {
        try {
          const blob = await upload(`attachments/${Date.now()}-${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/upload/sign",
            contentType: file.type || undefined,
          });
          const att = await createAttachment({
            entityType: ENTITY_TYPES.EVENT_LOG,
            entityId: result.data.id,
            fileName: file.name,
            fileUrl: blob.url,
            fileSize: file.size,
            fileType: file.type,
          });
          if (att.success) uploaded++;
          else toast.error(`${file.name}: ${att.error}`);
        } catch (err) {
          console.error("[manual-note-form] Error al subir:", err);
          toast.error(`${file.name}: no se pudo subir`);
        }
      }
      return { uploaded, total: pending.length };
    },
    onSuccess: ({ uploaded, total }) => {
      const extra = total > 0 ? ` con ${uploaded} de ${total} archivo(s)` : "";
      toast.success(
        (intercomConversationId
          ? "Nota añadida y enviada a Intercom"
          : "Nota añadida al historial") + extra
      );
      setBody("");
      pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      setPending([]);
      queryClient.invalidateQueries({ queryKey: ["event-logs", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
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
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al añadir la nota");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if ((!trimmed && pending.length === 0) || mutation.isPending) return;
    // Pegar una captura sin escribir nada es un caso normal: en vez de dejar la
    // entrada muda, se describe lo que lleva adjunto.
    const images = pending.filter((p) => p.file.type.startsWith("image/")).length;
    const fallback =
      images === pending.length
        ? `Adjunta ${images} ${images === 1 ? "captura" : "capturas"}`
        : `Adjunta ${pending.length} ${pending.length === 1 ? "archivo" : "archivos"}`;
    mutation.mutate(trimmed || fallback);
  };

  const hasIntercom = Boolean(intercomConversationId);
  const remaining = MAX_LENGTH - body.length;
  const busy = mutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
        // Pegar una captura con Ctrl+V es la vía más rápida para un recorte de
        // conversación, que es justo el caso de uso habitual.
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files ?? []);
          if (files.length > 0) {
            e.preventDefault();
            addFiles(files);
          }
        }}
        placeholder={
          hasIntercom
            ? "Escribe una nota — se publicará también como nota interna en Intercom. Pega una captura con Ctrl+V"
            : "Escribe una nota para el historial. Pega una captura con Ctrl+V"
        }
        rows={3}
        disabled={busy}
        className="resize-none"
      />

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((p, i) => (
            <div key={`${p.file.name}-${i}`} className="relative">
              {p.preview ? (
                // Vista previa local (blob:), que next/image no optimiza.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.preview}
                  alt={p.file.name}
                  className="h-16 w-16 rounded-md border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted px-1 text-center text-[10px] leading-tight text-muted-foreground">
                  {p.file.name.slice(0, 18)}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                disabled={busy}
                aria-label={`Quitar ${p.file.name}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {hasIntercom
            ? "Se publicará como nota interna en Intercom con tu nombre."
            : "Sin conversación de Intercom vinculada — la nota se registrará solo en HSM."}
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_FILE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title="Adjuntar capturas, fotos o documentos"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{remaining}</span>
          <Button
            type="submit"
            size="sm"
            disabled={(!body.trim() && pending.length === 0) || busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Añadir al historial
          </Button>
        </div>
      </div>
    </form>
  );
}
