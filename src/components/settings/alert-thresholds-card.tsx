"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Loader2 } from "lucide-react";
import { updateSetting } from "@/server/actions/settings";
import type { AlertThresholds } from "@/lib/constants/alerts";
import { ALERT_THRESHOLD_LABELS } from "@/lib/constants/alerts";

interface AlertThresholdsCardProps {
  initialThresholds: AlertThresholds;
}

export function AlertThresholdsCard({ initialThresholds }: AlertThresholdsCardProps) {
  const router = useRouter();
  const [thresholds, setThresholds] = useState<AlertThresholds>(initialThresholds);

  const mutation = useMutation({
    mutationFn: () => updateSetting("alert_thresholds", thresholds),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Umbrales de alertas guardados");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
  });

  const fields: Array<{
    key: keyof AlertThresholds;
    unit: string;
    min: number;
    max?: number;
  }> = [
    { key: "incidentStaleDays", unit: "días", min: 1 },
    { key: "rmaStuckProviderDays", unit: "días", min: 1 },
    { key: "rmaWarehouseDays", unit: "días", min: 1 },
    { key: "slaWarningPercent", unit: "%", min: 1, max: 100 },
  ];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Umbrales de Alertas
        </CardTitle>
        <CardDescription>
          Configura los límites de tiempo y porcentaje que activan alertas en la barra lateral y el panel de alertas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ key, unit, min, max }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{ALERT_THRESHOLD_LABELS[key]}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={key}
                  type="number"
                  min={min}
                  max={max}
                  value={thresholds[key]}
                  onChange={(e) =>
                    setThresholds((prev) => ({
                      ...prev,
                      [key]: Number(e.target.value),
                    }))
                  }
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full"
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar umbrales de alertas
        </Button>
      </CardContent>
    </Card>
  );
}
