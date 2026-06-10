import type { Metadata } from "next";
import { RmasScreen } from "@/components/rmas-v2/rmas-screen";

export const metadata: Metadata = { title: "RMAs" };

// Lista densa con drawer de detalle (fetch en cliente, estilo prototipo).
export const dynamic = "force-dynamic";

export default function RmasPage() {
  return <RmasScreen />;
}
