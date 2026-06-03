"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { MonitorSmartphone } from "lucide-react";
import type { DeviceTypeBreakdown } from "@/server/queries/analytics";
import { DEVICE_TYPE_LABELS } from "@/lib/constants/device-types";

// Paleta Qamarero: brand naranja primero, luego semánticos + acentos.
const COLORS = [
  "#ff592f", // orange-500 (brand)
  "#02995d", // green-500
  "#ffaa00", // amber-500
  "#0370dd", // blue-500
  "#b56cf5", // purple-500
  "#f50a48", // red-500
  "#ff8b6c", "#2bd58f", "#4ea3ff", "#d49aff",
  "#757575", "#ffc94d",
];

interface Props {
  data: DeviceTypeBreakdown[];
}

export function DeviceTypeDistribution({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    name: DEVICE_TYPE_LABELS[d.deviceType as keyof typeof DEVICE_TYPE_LABELS] ?? d.deviceType,
  }));

  return (
    <Card
      style={{ animation: "fadeInUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <MonitorSmartphone className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">Incidencias por tipo de dispositivo</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Sin datos
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  animationBegin={100}
                  animationDuration={800}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} incidencias`, name]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--popover))",
                    color: "hsl(var(--popover-foreground))",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Custom legend grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {chartData.map((entry, i) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-2 text-xs"
                  style={{ animation: `fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) ${300 + i * 30}ms both` }}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate text-muted-foreground">{entry.name}</span>
                  <span className="ml-auto tabular-nums font-medium">{entry.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
