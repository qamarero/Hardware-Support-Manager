import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: "blue" | "green" | "amber" | "purple" | "red";
  trend?: {
    value: number;
    label: string;
  };
}

const COLOR_MAP = {
  blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  purple: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
  red: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
};

export function KpiCard({ title, value, subtitle, icon: Icon, color, trend }: KpiCardProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${COLOR_MAP[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/70">{subtitle}</p>
          )}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            trend.value > 0 ? "text-red-500" : trend.value < 0 ? "text-emerald-500" : "text-muted-foreground"
          }`}>
            {trend.value > 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : trend.value < 0 ? (
              <TrendingDown className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
            <span>{trend.value > 0 ? "+" : ""}{trend.value}%</span>
            <span className="text-muted-foreground/70">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
