export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // El `.*\\.[\\w]+$` final excluye los ficheros de public/ (fuentes, SVG…).
    // Sin él, un Visor recibía un 302 a /consulta al pedir
    // /fonts/DMSans-VariableFont_opsz_wght.ttf: el navegador se encontraba
    // HTML donde esperaba la tipografía y la app se veía sin fuente.
    // Son ficheros que Next sirve estáticamente, así que dejarlos fuera del
    // middleware no expone nada que no fuera ya público.
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.[\\w]+$).*)",
  ],
};
