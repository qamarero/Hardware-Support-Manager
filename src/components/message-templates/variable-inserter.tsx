"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Code } from "lucide-react";
import {
  variablesForCategory,
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
} from "@/lib/constants/message-templates";

interface VariableInserterProps {
  onInsert: (variable: string) => void;
  /**
   * Categoría de la plantilla que se está editando. Solo se ofrecen las
   * variables que su generador sabe rellenar: ofrecerlas todas era lo que
   * dejaba `{{incidentNumber}}` literal en los correos al proveedor.
   */
  category: TemplateCategory;
}

export function VariableInserter({ onInsert, category }: VariableInserterProps) {
  const variables = variablesForCategory(category);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Code className="mr-2 h-4 w-4" />
          Insertar variable
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-64 overflow-y-auto" align="start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Disponibles en plantillas de{" "}
            {TEMPLATE_CATEGORY_LABELS[category]?.toLowerCase() ?? category} — haz
            clic para insertar en el cursor
          </p>
          <div className="flex flex-wrap gap-1">
            {variables.map((v) => (
              <Badge
                key={v.key}
                variant="secondary"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                title={`{{${v.key}}}`}
                onClick={() => onInsert(`{{${v.key}}}`)}
              >
                {v.label}
              </Badge>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
