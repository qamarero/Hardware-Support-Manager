"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, User, UserMinus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  fetchUsersForSelect,
  quickAssignIncident,
} from "@/server/actions/incidents";

interface AssigneeQuickPickerProps {
  incidentId: string;
  /** Current assignee user id, or null if unassigned. */
  currentUserId: string | null;
  /** Current assignee name (for display before opening). */
  currentUserName: string | null;
  /** Visual variant — `compact` for tables, `default` for detail page. */
  variant?: "compact" | "default";
  /** Optional className for the trigger. */
  className?: string;
  /** Stop propagation on click — useful inside a row link. */
  stopPropagation?: boolean;
  /** Optional callback after a successful change. */
  onAssigned?: (userId: string | null, userName: string | null) => void;
}

/**
 * Inline picker for changing the assigned technician without opening the
 * full incident editor. Renders as a small button (showing current name or
 * "Sin asignar") that opens a Popover with searchable list + an unassign
 * option. Optimistic — fires server action, toast on success/error.
 */
export function AssigneeQuickPicker({
  incidentId,
  currentUserId,
  currentUserName,
  variant = "default",
  className = "",
  stopPropagation = false,
  onAssigned,
}: AssigneeQuickPickerProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Lazy fetch — only when popover opens
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", "select"],
    queryFn: () => fetchUsersForSelect(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (userId: string | null) => quickAssignIncident(incidentId, userId),
    onSuccess: (result, variables) => {
      if (result.success) {
        const newUser = variables ? users.find((u) => u.id === variables) : null;
        toast.success(
          variables === null
            ? "Asignación retirada"
            : `Asignado a ${newUser?.name ?? "técnico"}`,
        );
        // Invalidate listings + detail caches
        queryClient.invalidateQueries({ queryKey: ["incidents"] });
        queryClient.invalidateQueries({ queryKey: ["incident", incidentId] });
        queryClient.invalidateQueries({
          queryKey: ["event-logs", "incident", incidentId],
        });
        onAssigned?.(variables, newUser?.name ?? null);
      } else {
        toast.error(result.error ?? "Error al asignar");
      }
      setOpen(false);
    },
    onError: () => {
      toast.error("Error al asignar");
      setOpen(false);
    },
  });

  const handleSelect = (userId: string | null) => {
    if (userId === currentUserId) {
      setOpen(false);
      return;
    }
    mutation.mutate(userId);
  };

  const triggerClasses =
    variant === "compact"
      ? "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs hover:bg-muted/60 transition-colors max-w-full"
      : "inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
        }}
      >
        <button
          type="button"
          className={`${triggerClasses} ${className}`}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : currentUserName ? (
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <UserMinus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className={currentUserName ? "" : "text-muted-foreground italic"}>
            {currentUserName ?? "Sin asignar"}
          </span>
          {variant !== "compact" && (
            <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
        }}
      >
        <Command>
          <CommandInput placeholder="Buscar técnico..." />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandGroup>
                  {users.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={u.name}
                      onSelect={() => handleSelect(u.id)}
                    >
                      <User className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1">{u.name}</span>
                      {u.id === currentUserId && (
                        <Check className="ml-2 h-3.5 w-3.5 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {currentUserId && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value="__unassign__"
                        onSelect={() => handleSelect(null)}
                      >
                        <UserMinus className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Retirar asignación
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
