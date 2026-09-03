"use client";

/**
 * Miniatura de un fichero adjunto.
 *
 * Las imágenes se ven directamente: la mayoría de adjuntos del departamento son
 * capturas de conversación, fotos de etiquetas o del equipo, y obligar a abrir
 * cada una en otra pestaña para saber cuál es la que buscas no tiene sentido.
 * Los blobs se suben con acceso público, así que sirven como `src` sin firmar.
 *
 * Para lo que no es imagen se pinta un recuadro con su extensión: un PDF no se
 * puede previsualizar sin cargar un visor entero.
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

export function FileThumb({ fileUrl, fileName, fileType, size = 64 }: FileThumbProps) {
  const isImage = fileType.startsWith("image/") && !fileType.includes("svg");
  const box = { width: size, height: size };

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`${fileName} — abrir en otra pestaña`}
      className="block shrink-0 overflow-hidden rounded-md border transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2"
      style={box}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={fileName}
          loading="lazy"
          className="h-full w-full object-cover"
          style={box}
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-muted text-muted-foreground">
          <span className="text-[10px] font-semibold tracking-wide">
            {extension(fileName, fileType)}
          </span>
          <span className="max-w-full truncate px-1 text-[9px] leading-tight">
            {fileName}
          </span>
        </span>
      )}
    </a>
  );
}
