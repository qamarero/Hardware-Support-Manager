"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck } from "lucide-react";
import type { TechnicianPerformance } from "@/server/queries/dashboard";

const chartConfig = {
  resolved: {
    label: "Resueltas",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

interface TechnicianChartProps {
  data: TechnicianPerformance[];
}

export function TechnicianChart({ data }: TechnicianChartProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <UserCheck className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base font-semibold">Rendimiento por Técnico</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Sin datos de rendimiento
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={100}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="resolved"
                fill="var(--color-chart-2)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
