"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumbs } from "./breadcrumbs";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/60 bg-card/80 px-4 sm:px-6 shadow-[0_1px_0_0_oklch(0_0_0/0.05)] backdrop-blur-md">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <Breadcrumbs />
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
