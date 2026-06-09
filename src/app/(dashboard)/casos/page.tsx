import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { CasosContent } from "@/components/casos/casos-content";

export const metadata: Metadata = {
  title: "Casos",
};

// Usa estado de URL (nuqs) en el cliente → renderizado dinámico.
export const dynamic = "force-dynamic";

export default function CasosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Casos</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline unificado: cada incidencia con su RMA vinculado.
          </p>
        </div>
      </div>
      <CasosContent />
    </div>
  );
}
