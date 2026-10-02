import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const destino = new URL("/login", request.url);
  const res = NextResponse.redirect(destino);

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

  // Que ninguna capa intermedia guarde esta respuesta: devolvería un cierre de
  // sesión ya consumido y el navegador no borraría nada.
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
