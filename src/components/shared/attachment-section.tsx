"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Paperclip,
  Upload,
  Trash2,
  FileText,
  Image,
  File,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchAttachments,
  createAttachment,
  deleteAttachment,
} from "@/server/actions/attachments";
import { formatRelativeTime } from "@/lib/utils/date-format";
import {
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  type EntityType,
} from "@/lib/constants/attachments";

interface AttachmentSectionProps {
  entityType: EntityType;
  entityId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.includes("pdf") || fileType.includes("document") || fileType.includes("text"))
    return FileText;
  return File;
}

export function AttachmentSection({
  entityType,
  entityId,
}: AttachmentSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["attachments", entityType, entityId],
    queryFn: () => fetchAttachments(entityType, entityId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Adjunto eliminado");
        queryClient.invalidateQueries({
          queryKey: ["attachments", entityType, entityId],
        });
        queryClient.invalidateQueries({
          queryKey: ["event-logs", entityType, entityId],
        });
      } else {
        toast.error(result.error);
      }
    },
    onError: () => toast.error("Error al eliminar el adjunto"),
  });

  // Sube uno o varios archivos en secuencia (input múltiple, drag&drop o pegar).
  const handleFiles = async (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    const limitMb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    setIsUploading(true);
    let ok = 0;
    try {
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name}: excede ${limitMb} MB`);
          continue;
        }
        if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
          toast.error(`${file.name}: tipo no permitido (${file.type || "desconocido"})`);
          continue;
        }
        try {
          // Upload directo navegador → Vercel Blob (bypass del límite 4.5 MB).
          // Prefijo con timestamp para evitar colisiones al subir varios.
          const blob = await upload(`attachments/${Date.now()}-${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/upload/sign",
            contentType: file.type || undefined,
          });
          const result = await createAttachment({
            entityType,
            entityId,
            fileName: file.name,
            fileUrl: blob.url,
            fileSize: file.size,
            fileType: file.type,
          });
          if (result.success) ok++;
          else toast.error(result.error);
        } catch (err) {
          console.error("[attachment-section] Error al subir:", err);
          const msg = err instanceof Error && err.message ? err.message : "error al subir";
          toast.error(`${file.name}: ${msg}`);
        }
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    if (ok > 0) {
      toast.success(ok === 1 ? "Adjunto subido" : `${ok} adjuntos subidos`);
      queryClient.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["event-logs", entityType, entityId] });
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.kind === "file")
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  return (
    <Card
      onPaste={onPaste}
      onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      className={dragging ? "ring-2 ring-primary" : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Adjuntos
        </CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Subir archivos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin adjuntos · arrastra archivos aquí o pega una captura (Ctrl+V)
          </p>
        ) : (
          <ul className="divide-y">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.fileType);
              return (
                <li
                  key={att.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline truncate block"
                      >
                        {att.fileName}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(att.fileSize)} &middot;{" "}
                        {att.uploadedByName ?? "Sistema"} &middot;{" "}
                        {formatRelativeTime(att.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => { if (window.confirm(`¿Eliminar "${att.fileName}"? Esta acción no se puede deshacer.`)) deleteMutation.mutate(att.id); }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
