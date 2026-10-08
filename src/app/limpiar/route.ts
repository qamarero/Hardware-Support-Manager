import type { NextRequest } from "next/server";
import { clearSiteResponse, safeInternalPath } from "@/lib/utils/clear-site";

/**
 * Vacía la caché del navegador para este dominio SIN cerrar la sesión y vuelve
 * a la página de la que se venía (`?volver=/ruta`).
 *
 * Arregla la app sin estilos con la consola llena de `Unexpected token '<'`:
 * el navegador tenía guardado HTML en lugar de los chunks de /_next/static, y
 * como esos ficheros se sirven `immutable` durante un año no los vuelve a pedir
 * nunca; ni recargar ni borrar cookies lo arregla.
 *
 * Lo abre solo el script de autorreparación del layout raíz al detectar un
 * chunk roto, y también se puede abrir a mano.
 */
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const volver = safeInternalPath(request.nextUrl.searchParams.get("volver"), "/");
  return clearSiteResponse(volver, "Limpiando datos guardados de la aplicación…");
}
