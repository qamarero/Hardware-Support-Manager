"use client";

import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SortOrder } from "@/types";

interface DataTableColumnHeaderProps {
  title: string;
  sortKey: string;
  currentSortBy?: string;
  currentSortOrder?: SortOrder;
  onSort: (sortBy: string, sortOrder: SortOrder) => void;
}

export function DataTableColumnHeader({
  title,
  sortKey,
  currentSortBy,
  currentSortOrder,
  onSort,
}: DataTableColumnHeaderProps) {
  const isActive = currentSortBy === sortKey;

  function handleClick() {
    if (isActive) {
      onSort(sortKey, currentSortOrder === "asc" ? "desc" : "asc");
    } else {
      onSort(sortKey, "asc");
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={handleClick}
    >
      <span>{title}</span>
      {isActive ? (
        currentSortOrder === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}
