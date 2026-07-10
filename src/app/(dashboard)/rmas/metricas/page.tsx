import type { Metadata } from "next";
import { RmaMetricasScreen } from "@/components/rmas-v2/rma-metricas-screen";

export const metadata: Metadata = { title: "Métricas RMA · HSM" };

export default function RmaMetricasPage() {
  return <RmaMetricasScreen />;
}
