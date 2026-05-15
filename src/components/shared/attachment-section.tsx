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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación cliente antes de subir — feedback inmediato sin round-trip.
    if (file.size > MAX_FILE_SIZE) {
      const limitMb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
      toast.error(`El archivo excede el tamaño máximo permitido (${limitMb} MB)`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
      toast.error(`Tipo de archivo no permitido (${file.type || "desconocido"})`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      // Upload directo navegador → Vercel Blob (bypass del límite 4.5 MB de
      // serverless functions). El endpoint /api/upload/sign firma el token.
      const blob = await upload(`attachments/${file.name}`, file, {
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

      if (result.success) {
        toast.success("Adjunto subido correctamente");
        queryClient.invalidateQueries({
          queryKey: ["attachments", entityType, entityId],
        });
        queryClient.invalidateQueries({
          queryKey: ["event-logs", entityType, entityId],
        });
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error("[attachment-section] Error al subir:", err);
      const message = err instanceof Error ? err.message : "Error al subir el archivo";
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Adjuntos
        </CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
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
            Subir archivo
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
            Sin adjuntos
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
                    onClick={() => deleteMutation.mutate(att.id)}
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
