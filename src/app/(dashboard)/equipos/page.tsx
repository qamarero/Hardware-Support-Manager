import type { Metadata } from "next";
import { EquiposScreen } from "@/components/equipos-v2/equipos-screen";

export const metadata: Metadata = { title: "Equipos" };
export const dynamic = "force-dynamic";

export default function EquiposPage() {
  return <EquiposScreen />;
}
