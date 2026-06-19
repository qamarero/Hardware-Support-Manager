import type { Metadata } from "next";
import { MiDiaScreen } from "@/components/mi-dia/mi-dia-screen";

export const metadata: Metadata = { title: "Mi día" };

export const dynamic = "force-dynamic";

export default function MiDiaPage() {
  return <MiDiaScreen />;
}
