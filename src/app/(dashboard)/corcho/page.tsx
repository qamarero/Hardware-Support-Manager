import type { Metadata } from "next";
import { CorchoScreen } from "@/components/tablero-v2/corcho-screen";

export const metadata: Metadata = { title: "Corcho" };

export default function CorchoPage() {
  return <CorchoScreen />;
}
