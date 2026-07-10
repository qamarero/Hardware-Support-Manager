import type { Metadata } from "next";
import { MetricasScreen } from "@/components/dashboard-v2/metricas-screen";

export const metadata: Metadata = { title: "Métricas soporte · HSM" };

// Usa nuqs (useSearchParams) + datos dinámicos tras auth → no prerenderizar.
export const dynamic = "force-dynamic";

export default function MetricasPage() {
  return <MetricasScreen />;
}
