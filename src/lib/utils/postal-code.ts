/**
 * Autocompletar ciudad a partir del código postal español.
 *
 * Usa la API pública gratuita zippopotam.es (sin clave, con CORS, HTTPS). Para
 * un CP español devuelve el municipio/localidad. Devuelve null si el CP no es
 * válido, no se encuentra o la API falla — el autocompletado es best-effort y
 * nunca debe romper el formulario. Solo cliente (fetch en el navegador).
 *
 * Ej.: "46100" → "Burjassot".
 */
export async function lookupSpanishCity(postalCode: string): Promise<string | null> {
  const cp = (postalCode ?? "").trim();
  if (!/^\d{5}$/.test(cp)) return null;
  try {
    const res = await fetch(`https://api.zippopotam.es/es/${cp}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: Array<Record<string, string>> };
    const place = data?.places?.[0]?.["place name"];
    return typeof place === "string" && place.trim() ? place.trim() : null;
  } catch {
    return null;
  }
}
