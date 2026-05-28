import type { Metadata } from "next";
import localFont from "next/font/local";
import { Space_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/shared/query-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import "./globals.css";

// DM Sans (Qamarero) — fuente variable self-hosted desde el handoff.
const dmSans = localFont({
  src: "../../public/fonts/DMSans-VariableFont_opsz_wght.ttf",
  variable: "--font-sans",
  display: "swap",
  weight: "100 1000",
});

// Space Mono (Qamarero) — para IDs, números y datos.
const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

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
      <body className={`${dmSans.variable} ${spaceMono.variable} antialiased`}>
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
