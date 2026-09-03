import type { Metadata } from "next";
import { MetricasScreen } from "@/components/dashboard-v2/metricas-screen";

// El layout raíz ya añade « | HSM» con su plantilla de títulos.
export const metadata: Metadata = { title: "Métricas soporte" };

// Usa nuqs (useSearchParams) + datos dinámicos tras auth → no prerenderizar.
export const dynamic = "force-dynamic";

export default function MetricasPage() {
  return <MetricasScreen />;
}
