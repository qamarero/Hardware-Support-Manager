"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertOctagon } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertOctagon className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-2xl font-bold">Algo salió mal</h2>
      <p className="max-w-md text-muted-foreground">
        Se produjo un error inesperado. Puedes intentar recargar la página o volver al panel de control.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">Ir al panel</a>
        </Button>
      </div>
    </div>
  );
}
