const BOM = "\uFEFF";
export const CSV_BOM = BOM;

function escape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Quita el BOM de un bloque ya generado. Necesario al concatenar varios bloques
 * en un mismo fichero: el BOM solo tiene sentido al principio y en medio del
 * texto aparece como basura en el visor.
 */
export function stripBom(csv: string): string {
  return csv.startsWith(BOM) ? csv.slice(BOM.length) : csv;
}

/**
 * Cabecera de metadatos del fichero, como comentarios `# clave,valor…`.
 *
 * Va antes de la tabla para que un CSV archivado diga por sí solo qué periodo
 * cubre y con qué corte se calcularon las métricas de stock. Sigue siendo
 * parseable (una línea por entrada, valores separados por comas) y quien solo
 * quiera la tabla puede descartar las líneas que empiezan por `#`.
 */
export function generateMetaHeader(
  entries: (string | number | null | undefined)[][]
): string {
  return entries.map((cells) => `# ${cells.map(escape).join(",")}`).join("\r\n");
}

export function generateCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];

  return BOM + lines.join("\r\n");
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
