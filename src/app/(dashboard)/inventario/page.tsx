import type { Metadata } from "next";
import { InventarioScreen } from "@/components/inventario-v2/inventario-screen";

export const metadata: Metadata = { title: "Inventario" };

export const dynamic = "force-dynamic";

export default function InventarioPage() {
  return <InventarioScreen />;
}
