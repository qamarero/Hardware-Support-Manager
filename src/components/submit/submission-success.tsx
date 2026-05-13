"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SubmissionSuccessProps {
  onReset: () => void;
}

export function SubmissionSuccess({ onReset }: SubmissionSuccessProps) {
  return (
    <Card className="border-green-500/30">
      <CardContent className="pt-10 pb-10 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">¡Sumisión recibida!</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Hemos recibido tu reporte. El equipo de soporte hardware lo revisará y
            creará la incidencia correspondiente lo antes posible.
          </p>
        </div>

        <div className="rounded-lg bg-muted/40 p-4 text-left max-w-md mx-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            ¿Qué pasa ahora?
          </p>
          <ul className="text-sm space-y-1 text-foreground/80">
            <li>• Domi revisará tu sumisión en las próximas horas</li>
            <li>• Si todo está claro, creará la incidencia en HSM</li>
            <li>• Si necesita más info, te contactará por email</li>
          </ul>
        </div>

        <Button onClick={onReset} variant="outline">
          Enviar otra sumisión
        </Button>
      </CardContent>
    </Card>
  );
}
