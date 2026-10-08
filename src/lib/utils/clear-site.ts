import { NextResponse } from "next/server";

/**
 * Nombre de la cookie que marca "este equipo ya se limpió hace poco". La lee el
 * script de autorreparación del layout para no entrar en bucle si, tras
 * limpiar, los chunks siguen llegando rotos (p. ej. un proxy que los reescribe).
 * No es httpOnly a propósito: la tiene que ver ese script.
 */
export const CLEAR_SITE_COOKIE = "hsm_limpiado";

/**
 * Devuelve solo rutas internas ("/algo"). Cualquier otra cosa —URL absoluta,
 * "//dominio", "/\dominio"— cae a `fallback` para no abrir una redirección a
 * un sitio externo.
 */
export function safeInternalPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Respuesta que vacía la caché y el almacenamiento del navegador para este
 * dominio y luego lleva a `destino`.
 *
 * Es una página mínima y no un 302 porque Clear-Site-Data no se aplica de forma
 * fiable en redirecciones en todos los navegadores. Sin JavaScript ni recursos
 * externos: es justo lo que puede estar roto en el equipo que llega aquí.
 *
 * "cookies" NO va en Clear-Site-Data a propósito: borra las de todo el dominio
 * registrable (qamarero.com) y sacaría a la gente de otras herramientas.
 */
export function clearSiteResponse(destino: string, mensaje: string): NextResponse {
  const href = escapeHtml(destino);
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="1;url=${href}">
<title>${escapeHtml(mensaje)} | HSM</title>
</head>
<body style="font-family:system-ui,sans-serif;padding:2rem">
<p>${escapeHtml(mensaje)}</p>
<p><a href="${href}">Continuar</a></p>
</body>
</html>`;

  const res = new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  res.headers.set("Clear-Site-Data", '"cache", "storage"');
  // Que ninguna capa intermedia guarde esta respuesta: devolvería una limpieza
  // ya consumida y el navegador no borraría nada.
  res.headers.set("Cache-Control", "no-store, max-age=0");
  // Diez minutos sin volver a intentarlo de forma automática.
  res.cookies.set(CLEAR_SITE_COOKIE, "1", { path: "/", maxAge: 600, sameSite: "lax" });
  return res;
}
