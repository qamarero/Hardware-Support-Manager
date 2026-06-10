import type { Metadata } from "next";
import { CasosContent } from "@/components/casos/casos-content";

export const metadata: Metadata = { title: "Casos" };

// Usa estado de URL (nuqs) en el cliente → renderizado dinámico.
export const dynamic = "force-dynamic";

export default function CasosPage() {
  return <CasosContent />;
}
