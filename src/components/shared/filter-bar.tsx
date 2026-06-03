"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, X } from "lucide-react";
import type { FilterConfig } from "@/lib/constants/filter-options";
import { FilterMultiSelect } from "./filter-multi-select";
import { FilterDateRange } from "./filter-date-range";
import { useIsMobile } from "@/hooks/use-mobile";

interface FilterBarProps {
  filters: FilterConfig[];
  params: Record<string, unknown>;
  onFilterChange: (key: string, value: string | string[] | null) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
}

export function FilterBar({
  filters,
  params,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
}: FilterBarProps) {
  // A5/C2: en desktop los filtros se muestran abiertos por defecto (el técnico
  // está en desktop ~95% del tiempo y así no necesita un click extra para ver
  // qué filtros existen). En mobile, cerrados salvo que haya filtros activos.
  // `manualOpen` recoge el toggle explícito del usuario y prevalece.
  const isMobile = useIsMobile();
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const isOpen = manualOpen ?? (!isMobile || activeFilterCount > 0);

  // Build active filter chips for visual feedback
  const activeChips: { key: string; filterKey: string; label: string }[] = [];
  for (const filter of filters) {
    if (filter.type === "multi-select" && filter.options) {
      const values = (params[filter.key] as string[]) ?? [];
      for (const v of values) {
        const option = filter.options.find((o) => o.value === v);
        if (option) {
          activeChips.push({ key: `${filter.key}-${v}`, filterKey: filter.key, label: option.label });
        }
      }
    }
  }

  const removeChip = (filterKey: string, chipLabel: string) => {
    const filter = filters.find((f) => f.key === filterKey);
    if (!filter?.options) return;
    const option = filter.options.find((o) => o.label === chipLabel);
    if (!option) return;
    const current = (params[filterKey] as string[]) ?? [];
    const next = current.filter((v) => v !== option.value);
    onFilterChange(filterKey, next.length > 0 ? next : null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setManualOpen(!isOpen)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="size-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 min-w-[1.25rem] px-1 py-0 text-xs font-semibold bg-primary text-primary-foreground"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="gap-1 text-muted-foreground hover:text-foreground h-8"
          >
            <X className="size-3" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Filter controls — no overflow-hidden so popovers aren't clipped */}
      {isOpen && (
        <div
          className="flex flex-wrap items-center gap-2 pb-1 pt-1"
          style={{ animation: "fadeInUp 250ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          {filters.map((filter, i) => {
            if (filter.type === "multi-select" && filter.options) {
              const value = (params[filter.key] as string[]) ?? [];
              return (
                <div
                  key={filter.key}
                  style={{ animation: `fadeInUp 250ms ease-out ${i * 40}ms both` }}
                >
                  <FilterMultiSelect
                    label={filter.label}
                    options={filter.options}
                    value={value}
                    onChange={(v) =>
                      onFilterChange(filter.key, v.length > 0 ? v : null)
                    }
                  />
                </div>
              );
            }

            if (filter.type === "date-range") {
              const from = (params[`${filter.key}From`] as string) ?? undefined;
              const to = (params[`${filter.key}To`] as string) ?? undefined;
              return (
                <div
                  key={filter.key}
                  style={{ animation: `fadeInUp 250ms ease-out ${i * 40}ms both` }}
                >
                  <FilterDateRange
                    label={filter.label}
                    from={from}
                    to={to}
                    onFromChange={(v) =>
                      onFilterChange(`${filter.key}From`, v)
                    }
                    onToChange={(v) =>
                      onFilterChange(`${filter.key}To`, v)
                    }
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={() => removeChip(chip.filterKey, chip.label)}
            >
              {chip.label}
              <X className="size-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
