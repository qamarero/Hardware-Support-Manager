"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumbs } from "./breadcrumbs";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  return (
    <header className="flex h-16 items-center gap-4 bg-card px-6 shadow-sm">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <Breadcrumbs />
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
