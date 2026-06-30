import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

const emailOnlySchema = z.object({
  email: z.string().email(),
});

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/incidents") ||
        nextUrl.pathname.startsWith("/rmas") ||
        nextUrl.pathname.startsWith("/providers") ||
        nextUrl.pathname.startsWith("/clients") ||
        nextUrl.pathname.startsWith("/users") ||
        nextUrl.pathname.startsWith("/settings") ||
        nextUrl.pathname.startsWith("/intercom") ||
        nextUrl.pathname.startsWith("/warehouse") ||
        nextUrl.pathname.startsWith("/analytics") ||
        nextUrl.pathname.startsWith("/submissions") ||
        nextUrl.pathname.startsWith("/equipos") ||
        nextUrl.pathname.startsWith("/etiqueta");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      }

      if (isLoggedIn && nextUrl.pathname === "/login") {
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
      },
      async authorize(credentials) {
        const parsed = emailOnlySchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email } = parsed.data;

        // TODO: Re-enable password verification
        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
          })
          .from(users)
          .where(and(eq(users.email, email), isNull(users.deletedAt)))
          .limit(1);

        if (!user) return null;

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
