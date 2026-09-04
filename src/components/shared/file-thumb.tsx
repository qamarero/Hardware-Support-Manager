"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Miniatura de un fichero adjunto.
 *
 * Las imágenes se ven directamente: la mayoría de adjuntos del departamento son
 * capturas de conversación, fotos de etiquetas o del equipo, y obligar a abrir
 * cada una en otra pestaña para saber cuál es la que buscas no tiene sentido.
 * Los blobs se suben con acceso público, así que sirven como `src` sin firmar.
 *
 * Al pulsarla se amplía sobre la propia página en lugar de abrir una pestaña:
 * estas imágenes se consultan de pasada —«¿es esta la etiqueta?»— y salir del
 * caso para volver enseguida rompía el hilo de lo que estabas haciendo.
 *
 * Para lo que no es imagen se pinta un recuadro con su extensión y se sigue
 * abriendo en otra pestaña: el navegador ya trae visor de PDF y no tiene
 * sentido replicarlo aquí.
 */

interface FileThumbProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  /** Lado de la miniatura en píxeles. */
  size?: number;
}

function extension(fileName: string, fileType: string): string {
  const fromName = fileName.includes(".") ? fileName.split(".").pop() : null;
  if (fromName && fromName.length <= 5) return fromName.toUpperCase();
  if (fileType.includes("pdf")) return "PDF";
  if (fileType.includes("sheet") || fileType.includes("excel")) return "XLS";
  if (fileType.includes("word") || fileType.includes("document")) return "DOC";
  if (fileType.startsWith("text/")) return "TXT";
  return "FILE";
}

const FRAME =
  "block shrink-0 overflow-hidden rounded-md border transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2";

export function FileThumb({ fileUrl, fileName, fileType, size = 64 }: FileThumbProps) {
  const [open, setOpen] = useState(false);
  const isImage = fileType.startsWith("image/") && !fileType.includes("svg");
  const box = { width: size, height: size };

  if (!isImage) {
    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`${fileName} — abrir en otra pestaña`}
        className={FRAME}
        style={box}
      >
        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-muted text-muted-foreground">
          <span className="text-[10px] font-semibold tracking-wide">
            {extension(fileName, fileType)}
          </span>
          <span className="max-w-full truncate px-1 text-[9px] leading-tight">
            {fileName}
          </span>
        </span>
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${fileName} — ampliar`}
        className={`${FRAME} cursor-zoom-in`}
        style={box}
      >
        {/* Blob público, que next/image no optimiza. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt={fileName}
          loading="lazy"
          className="h-full w-full object-cover"
          style={box}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* El ancho lo manda la imagen, no la rejilla del diálogo. La cabecera
            va en su propia fila para dejar libre la esquina del botón cerrar. */}
        <DialogContent className="w-auto max-w-[min(96vw,1400px)] gap-2 p-3 sm:max-w-[min(96vw,1400px)]">
          <DialogTitle className="sr-only">{fileName}</DialogTitle>
          <div className="flex items-center justify-between gap-4 pr-7 text-xs text-muted-foreground">
            <span className="truncate" title={fileName}>
              {fileName}
            </span>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 hover:text-foreground hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Tamaño original
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt={fileName}
            className="max-h-[78vh] max-w-full rounded object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
