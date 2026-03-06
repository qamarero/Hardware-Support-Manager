"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "lucide-react";
import type { AgingBucket } from "@/server/queries/dashboard";

const chartConfig = {
  count: {
    label: "Incidencias",
    color: "var(--color-chart-3)",
  },
} satisfies ChartConfig;

const BUCKET_COLORS: Record<string, string> = {
  "< 1 día": "var(--color-chart-2)",
  "1-3 días": "var(--color-chart-3)",
  "3-7 días": "var(--color-chart-4)",
  "7+ días": "var(--color-destructive)",
};

interface AgingChartProps {
  data: AgingBucket[];
}

export function AgingChart({ data }: AgingChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    fill: BUCKET_COLORS[item.bucket] ?? "var(--color-chart-1)",
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Timer className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base font-semibold">Backlog por Antigüedad</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || data.every((d) => d.count === 0) ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Sin incidencias en backlog
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
