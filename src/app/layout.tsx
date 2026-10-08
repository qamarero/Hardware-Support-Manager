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
function go(d){
location.replace("/limpiar?volver="+encodeURIComponent(location.pathname+location.search)+"&diag="+encodeURIComponent(JSON.stringify(d).slice(0,900)));
}
function heal(u){
if(done||document.cookie.indexOf("${CLEAR_SITE_COOKIE}=")>-1)return;
done=true;
var h=function(r,k){return r.headers.get(k)};
fetch(u,{cache:"no-store"}).then(function(r){return r.text().then(function(b){
return {u:u,s:r.status,url:r.url,ct:h(r,"content-type"),sv:h(r,"server"),vid:h(r,"x-vercel-id"),mit:h(r,"x-vercel-mitigated"),b:b.slice(0,300)}})})
.catch(function(e){return {u:u,err:String(e)}})
.then(go,function(){go({u:u})});
}
window.addEventListener("error",function(e){
var t=e.target,u;
if(t&&t!==window&&(t.tagName==="SCRIPT"||t.tagName==="LINK")){u=t.src||t.href;if(isAsset(u))heal(u);return}
if(isAsset(e.filename)&&e.error instanceof SyntaxError)heal(e.filename);
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
