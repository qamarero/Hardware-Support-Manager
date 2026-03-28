import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { getSlaThresholds, getDefaultPageSize, getDefaultView, getAlertThresholds } from "@/server/queries/settings";
import { SettingsContent } from "@/components/settings/settings-content";

export const metadata: Metadata = {
  title: "Configuración",
};

export default async function SettingsPage() {
  const [slaThresholds, defaultPageSize, defaultView, alertThresholds] = await Promise.all([
    getSlaThresholds(),
    getDefaultPageSize(),
    getDefaultView(),
    getAlertThresholds(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-muted-foreground">
            Ajustes del sistema y preferencias
          </p>
        </div>
      </div>
      <SettingsContent
        initialSla={slaThresholds}
        initialPageSize={defaultPageSize}
        initialView={defaultView}
        initialAlertThresholds={alertThresholds}
      />
    </div>
  );
}
