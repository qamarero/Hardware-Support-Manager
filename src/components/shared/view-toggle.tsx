"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ViewToggleProps {
  view: "table" | "canvas";
  onViewChange: (view: "table" | "canvas") => void;
  altLabel?: string;
}

export function ViewToggle({ view, onViewChange, altLabel = "Canvas" }: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(v) => {
        if (v) onViewChange(v as "table" | "canvas");
      }}
      className="gap-0 rounded-lg border bg-muted p-0.5"
    >
      <ToggleGroupItem
        value="table"
        aria-label="Vista tabla"
        className="gap-1.5 rounded-md px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        <Table2 className="h-4 w-4" />
        <span className="hidden sm:inline">Tabla</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="canvas"
        aria-label={`Vista ${altLabel.toLowerCase()}`}
        className="gap-1.5 rounded-md px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">{altLabel}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
