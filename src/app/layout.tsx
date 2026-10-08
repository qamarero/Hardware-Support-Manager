import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/shared/query-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { CLEAR_SITE_COOKIE } from "@/lib/utils/clear-site";
import "./globals.css";
// Sistema de diseño Qamarero portado 1:1 del prototipo. Se carga DESPUÉS de
// globals para que prevalezca en las pantallas nuevas (clases .btn/.card/...).
// Las fuentes (DM Sans self-hosted + Space Mono) las gestiona proto-tokens.css.
import "./proto-tokens.css";
import "./proto-app.css";

export const metadata: Metadata = {
  title: {
    default: "Hardware Support Manager",
    template: "%s | HSM",
  },
  description: "Sistema de gestión de soporte de hardware",
};

/**
 * Autorreparación de equipos con la caché envenenada.
 *
 * Síntoma: la app sale sin estilos y la consola se llena de
 * `Unexpected token '<'` porque el navegador tiene HTML guardado donde deberían
 * estar los chunks de /_next/static. Como esos ficheros son `immutable`, no se
 * arregla recargando ni cerrando sesión.
 *
 * Al detectar un chunk roto, se lleva al usuario a /limpiar, que vacía la caché
 * y le devuelve a la misma página. Va en línea en el <head> porque no puede
 * depender de los chunks, que son justo lo que está roto. La cookie que deja
 * /limpiar evita el bucle si tras limpiar siguen llegando rotos (eso ya sería
 * algo de la red, no de la caché).
 */
const SELF_HEAL_SCRIPT = `(function(){
var done=false;
function isAsset(u){return typeof u==="string"&&u.indexOf("/_next/static/")>-1}
function heal(){
if(done||document.cookie.indexOf("${CLEAR_SITE_COOKIE}=")>-1)return;
done=true;
location.replace("/limpiar?volver="+encodeURIComponent(location.pathname+location.search));
}
window.addEventListener("error",function(e){
var t=e.target;
if(t&&t!==window&&(t.tagName==="SCRIPT"||t.tagName==="LINK")){if(isAsset(t.src||t.href))heal();return}
if(isAsset(e.filename)&&e.error instanceof SyntaxError)heal();
},true);
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "production" && (
          <script dangerouslySetInnerHTML={{ __html: SELF_HEAL_SCRIPT }} />
        )}
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <SessionProvider>
            <QueryProvider>
              <NuqsAdapter>
                {children}
                <Toaster richColors position="top-right" />
              </NuqsAdapter>
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
