import { auth } from "@/lib/auth";

// `export default` y NO `export { auth as middleware } from "@/lib/auth"`.
// Con el re-export, `next build --turbopack` descartaba el `config` de abajo
// sin avisar y registraba el middleware para "/:path*". Resultado: corría
// también sobre /_next/static, y a un Visor con sesión cada chunk JS/CSS le
// devolvía un 302 a /consulta. El navegador recibía HTML donde esperaba JS:
// app sin estilos, consola llena de «Unexpected token '<'», y ni limpiar caché
// ni /logout lo arreglaban, porque al volver a entrar como Visor se repetía.
// Se comprueba en .next/server/middleware-manifest.json tras el build: los
// `matchers` deben reflejar este patrón, no "/:path*".
export default auth;

export const config = {
  matcher: [
    // Fuera del middleware: API, estáticos de Next y cualquier ruta que acabe
    // en extensión (fuentes, SVG… de public/). Son ficheros públicos que Next
    // sirve tal cual, así que excluirlos no expone nada.
    // `[.]` en vez de `\\.`: el análisis estático del build pierde las barras
    // invertidas (`\\.[\\w]` llegaba al manifest como `.[w]`).
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*[.][a-zA-Z0-9]+$).*)",
  ],
};
