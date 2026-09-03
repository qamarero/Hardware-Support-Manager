/**
 * Texto plano a partir de un asunto o cuerpo que viene de Intercom.
 *
 * Intercom entrega el asunto con marcado (`<p>…</p>`), y la Bandeja lo pintaba
 * literal: el equipo veía las etiquetas en los resúmenes de conversación. Se
 * limpia al mostrar y no al guardar, para no perder el original.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
