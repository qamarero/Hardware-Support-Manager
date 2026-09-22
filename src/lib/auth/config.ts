import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNull, and, sql } from "drizzle-orm";
import { loginSchema } from "@/lib/validators/user";

export const authConfig: NextAuthConfig = {
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

      if (isLoggedIn && path === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl));
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
