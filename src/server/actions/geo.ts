"use server";

/**
 * Búsqueda de municipio y provincia por código postal español. 100% local,
 * sin llamadas externas:
 * - Municipio: listado del Callejero del Censo Electoral (INE) en
 *   `src/lib/data/postal-codes.json` (licencia ODC-PDDL, dominio público).
 *   Ver `src/lib/data/README.md` para regenerarlo.
 * - Provincia: derivada del prefijo del CP (ver `src/lib/data/provincias.ts`).
 *
 * Se ejecuta en servidor, así que el JSON (~250 KB, ~11.000 CP) NO viaja en el
 * bundle del cliente.
 */
import postalCodes from "@/lib/data/postal-codes.json";
import { provinceFromPostalCode } from "@/lib/data/provincias";

const CP_TO_MUNICIPIO = postalCodes as Record<string, string>;

export async function lookupPostalCode(
  postalCode: string,
): Promise<{ municipio: string | null; provincia: string | null }> {
  const cp = (postalCode ?? "").trim();
  if (!/^\d{5}$/.test(cp)) return { municipio: null, provincia: null };
  return {
    municipio: CP_TO_MUNICIPIO[cp] ?? null,
    provincia: provinceFromPostalCode(cp),
  };
}
