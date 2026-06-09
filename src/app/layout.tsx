import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/shared/query-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
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
