"use client";

import { Zap } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "./breadcrumbs";
import { ThemeToggle } from "./theme-toggle";
import { useQuickConsultation } from "@/components/incidents/quick-consultation-modal";

export function AppHeader() {
  const { setOpen } = useQuickConsultation();
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setOpen(true)}
          title="Registrar consulta rápida (Ctrl+Q)"
        >
          <Zap className="h-3.5 w-3.5 text-warning" />
          <span className="hidden sm:inline">Consulta rápida</span>
          <kbd className="hidden rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground sm:inline">
            Ctrl+Q
          </kbd>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
