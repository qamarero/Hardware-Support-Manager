"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette, Clock, Settings2, Loader2, MessageSquareText } from "lucide-react";
import { ThemeSelector } from "./theme-selector";
import { updateSetting } from "@/server/actions/settings";
import { SLA_PRIORITY_LABELS, type SlaThresholds } from "@/lib/constants/sla";
import { AlertThresholdsCard } from "./alert-thresholds-card";
import type { AlertThresholds } from "@/lib/constants/alerts";

interface SettingsContentProps {
  initialSla: SlaThresholds;
  initialPageSize: number;
  initialView: "table" | "canvas";
  initialAlertThresholds: AlertThresholds;
}

export function SettingsContent({
  initialSla,
  initialPageSize,
  initialView,
  initialAlertThresholds,
}: SettingsContentProps) {
  const router = useRouter();
  const [sla, setSla] = useState(initialSla);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [defaultView, setDefaultView] = useState(initialView);

  const slaMutation = useMutation({
    mutationFn: () => updateSetting("sla_thresholds", sla),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Umbrales SLA guardados");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
  });

  const generalMutation = useMutation({
    mutationFn: async () => {
      const [r1, r2] = await Promise.all([
        updateSetting("default_page_size", pageSize),
        updateSetting("default_view", defaultView),
      ]);
      if (!r1.success) throw new Error(r1.error);
      if (!r2.success) throw new Error(r2.error);
    },
    onSuccess: () => {
      toast.success("Preferencias guardadas");
      router.refresh();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const priorities = Object.keys(SLA_PRIORITY_LABELS);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Apariencia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5" />
            Apariencia
          </CardTitle>
          <CardDescription>Personaliza el aspecto de la aplicación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ThemeSelector />
        </CardContent>
      </Card>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5" />
            General
          </CardTitle>
          <CardDescription>Preferencias generales del sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pageSize">Elementos por página</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger id="pageSize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultView">Vista por defecto</Label>
            <Select
              value={defaultView}
              onValueChange={(v) => setDefaultView(v as "table" | "canvas")}
            >
              <SelectTrigger id="defaultView">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Tabla</SelectItem>
                <SelectItem value="canvas">Tarjetas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => generalMutation.mutate()}
            disabled={generalMutation.isPending}
            className="w-full"
          >
            {generalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar preferencias
          </Button>
        </CardContent>
      </Card>

      {/* SLA */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Umbrales SLA
          </CardTitle>
          <CardDescription>
            Tiempo máximo permitido por prioridad (en horas). Se usan para indicadores SLA en el dashboard y detalles de incidencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Response SLA */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Tiempo de respuesta (horas)</h4>
              <p className="text-xs text-muted-foreground">
                Tiempo máximo desde la creación hasta el primer triaje
              </p>
              {priorities.map((p) => (
                <div key={`resp-${p}`} className="flex items-center gap-3">
                  <Label className="w-20 text-sm">{SLA_PRIORITY_LABELS[p]}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={sla.response[p]}
                    onChange={(e) =>
                      setSla({
                        ...sla,
                        response: { ...sla.response, [p]: Number(e.target.value) },
                      })
                    }
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">h</span>
                </div>
              ))}
            </div>

            {/* Resolution SLA */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Tiempo de resolución (horas)</h4>
              <p className="text-xs text-muted-foreground">
                Tiempo máximo desde la creación hasta la resolución
              </p>
              {priorities.map((p) => (
                <div key={`res-${p}`} className="flex items-center gap-3">
                  <Label className="w-20 text-sm">{SLA_PRIORITY_LABELS[p]}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={sla.resolution[p]}
                    onChange={(e) =>
                      setSla({
                        ...sla,
                        resolution: { ...sla.resolution, [p]: Number(e.target.value) },
                      })
                    }
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">h</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => slaMutation.mutate()}
            disabled={slaMutation.isPending}
            className="w-full"
          >
            {slaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar umbrales SLA
          </Button>
        </CardContent>
      </Card>

      {/* Umbrales de Alertas */}
      <AlertThresholdsCard initialThresholds={initialAlertThresholds} />

      {/* Plantillas de mensajes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquareText className="h-5 w-5" />
            Plantillas de Mensajes
          </CardTitle>
          <CardDescription>
            Plantillas para generar mensajes a clientes y proveedores desde incidencias y RMAs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/settings/templates">Gestionar plantillas</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
