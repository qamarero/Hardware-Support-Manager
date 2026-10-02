import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNull, and, sql } from "drizzle-orm";
import { loginSchema } from "@/lib/validators/user";

export const authConfig: NextAuthConfig = {
  /**
   * Las URLs de auth se construyen con el dominio por el que llega la petición,
   * no con uno fijo. Hace falta porque la app se sirve en dos:
   * `soporte.hardware.qamarero.com` y `hardware-support-manager.vercel.app`.
   *
   * Sin esto, NEXTAUTH_URL fija un dominio canónico y entrar por el otro te
   * expulsa a él: las cookies `__Secure-authjs.*` se crean allí, al volver no
   * hay sesión, y se entra en un ir y venir entre dominios.
   *
   * Es seguro en este despliegue porque Vercel solo entrega peticiones cuyo
   * Host es uno de los dominios dados de alta en el proyecto; no se puede
   * inyectar un Host arbitrario. En un servidor propio detrás de un proxy que
   * no sanee esa cabecera, NO sería seguro.
   *
   * Exige que NEXTAUTH_URL esté SIN DEFINIR en el entorno: si está, gana ella
   * y esto no sirve de nada.
   */
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string } | undefined)?.role;
      const path = nextUrl.pathname;

      // Rutas abiertas a cualquiera, con o sin sesión. Va ANTES del
      // confinamiento del Visor: si no, un compañero de soporte con la sesión
      // abierta no podía usar /submit — el formulario con el que reporta — y
      // acababa rebotado a /consulta sin entender por qué.
      //
      // La comparación es por segmento exacto a propósito:
      // "/submissions".startsWith("/submit") es true, y un startsWith a secas
      // abriría al público la cola interna de revisión.
      const PUBLIC_PREFIXES = ["/submit"];
      if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
        return true;
      }

      // El login va ANTES del confinamiento del Visor. Si no, un Visor que
      // quiere cerrar sesión o cambiar de cuenta es devuelto a /consulta y se
      // queda encerrado: el guard no le deja llegar a /login ni para salir.
      // Pasó de verdad — con la cuenta de soporte abierta no había forma de
      // volver a la de administrador sin borrar las cookies a mano.
      if (path === "/login") {
        // A quien ya tiene sesión y puede navegar se le ahorra el formulario.
        // Al Visor no: para él, /login es la única salida.
        if (isLoggedIn && role !== "viewer") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Rol "viewer" (compañeros de soporte): confinado a la pestaña Consulta
      // (solo lectura + comentarios). Cualquier otra ruta → redirige a /consulta.
      if (isLoggedIn && role === "viewer") {
        if (path.startsWith("/consulta")) return true;
        return Response.redirect(new URL("/consulta", nextUrl));
      }

      const isOnDashboard = path.startsWith("/dashboard") ||
        path.startsWith("/metricas") ||
        path.startsWith("/consulta") ||
        path.startsWith("/incidents") ||
        path.startsWith("/rmas") ||
        path.startsWith("/providers") ||
        path.startsWith("/clients") ||
        path.startsWith("/users") ||
        path.startsWith("/settings") ||
        path.startsWith("/intercom") ||
        path.startsWith("/warehouse") ||
        path.startsWith("/analytics") ||
        path.startsWith("/submissions") ||
        path.startsWith("/equipos") ||
        path.startsWith("/etiqueta");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "admin" | "technician" | "viewer";
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            passwordHash: users.passwordHash,
            active: users.active,
          })
          .from(users)
          // lower() en vez de comparar tal cual: quien teclea su correo no
          // tiene por qué respetar las mayúsculas con que se dio de alta.
          // No se usa ilike porque trataría el _ de un correo como comodín.
          .where(
            and(
              sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
              isNull(users.deletedAt),
            ),
          )
          .limit(1);

        if (!user || !user.active) return null;

        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
};
