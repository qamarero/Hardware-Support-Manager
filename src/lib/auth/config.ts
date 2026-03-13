import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

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
        nextUrl.pathname.startsWith("/users") ||
        nextUrl.pathname.startsWith("/settings");

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

        // TODO: Re-enable DB lookup and password verification
        // For now, accept any valid email as admin
        return {
          id: email,
          name: email.split("@")[0],
          email,
          role: "admin" as const,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
};
