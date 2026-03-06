"use client";

import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-2">
      <Label>Tema</Label>
      <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar tema" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Claro
            </div>
          </SelectItem>
          <SelectItem value="dark">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              Oscuro
            </div>
          </SelectItem>
          <SelectItem value="system">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Sistema
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
