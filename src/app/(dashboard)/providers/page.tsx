import type { Metadata } from "next";
import { ProvidersScreen } from "@/components/providers-v2/providers-screen";

export const metadata: Metadata = { title: "Proveedores" };

export const dynamic = "force-dynamic";

export default function ProvidersPage() {
  return <ProvidersScreen />;
}
