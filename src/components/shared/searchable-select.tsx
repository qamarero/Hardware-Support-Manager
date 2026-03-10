"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Normaliza texto: minúsculas, sin acentos ni diacríticos */
function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados.",
  emptyAction,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = normalize(search);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Buscador propio — sin cmdk */}
        <div className="flex items-center gap-2 border-b px-3 h-9">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm"
          />
        </div>

        {/* Lista de opciones */}
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filtered.length > 0 ? (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onValueChange(option.value === value ? "" : option.value);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground",
                  value === option.value && "bg-accent"
                )}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </button>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
        </div>

        {/* Acción cuando no hay resultados (ej: añadir cliente) */}
        {emptyAction && filtered.length === 0 && search.length > 0 && (
          <div className="border-t p-2">{emptyAction}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
