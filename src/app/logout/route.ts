import { cookies } from "next/headers";
import { clearSiteResponse } from "@/lib/utils/clear-site";

/**
 * Cierre de sesión por URL: basta con abrir /logout.
 *
 * Existe porque el botón de cerrar sesión no siempre basta. Depende de
 * JavaScript y de que `signOut()` consiga hablar con /api/auth/*, y en algunos
 * equipos esas respuestas llegan reescritas —devuelven HTML donde se espera
 * JSON—, así que la sesión se queda pegada. Cuando eso pasa, el único arreglo
 * era borrar cookies desde DevTools, que no es algo que se pueda pedir por
 * teléfono a cuatro personas.
 *
 * Esto no necesita JavaScript ni el botón: se escribe la dirección y listo.
 *
 * Borra las cookies por su nombre en vez de llamar a signOut() a propósito —
 * si signOut es justamente lo que falla, apoyarse en él no arreglaría nada.
 *
 * Además vacía la caché del navegador (ver /limpiar): el síntoma más habitual
 * en los equipos afectados era la app sin estilos y `Unexpected token '<'`,
 * que no se arregla borrando cookies.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const res = clearSiteResponse("/login", "Cerrando sesión y limpiando datos guardados…");

  const jar = await cookies();
  for (const c of jar.getAll()) {
    // Auth.js nombra las suyas `authjs.*`, y en HTTPS con los prefijos
    // `__Secure-` y `__Host-` delante. Se barre por coincidencia para no
    // depender de la lista exacta, que cambia entre versiones.
    if (c.name.toLowerCase().includes("authjs")) {
      // Hay que reescribirlas vacías y caducadas con el MISMO path con que se
      // crearon; borrarlas sin más deja la original intacta en el navegador.
      res.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
  }

  return res;
}
