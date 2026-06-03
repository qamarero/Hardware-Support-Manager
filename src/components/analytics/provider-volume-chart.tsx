"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Layers } from "lucide-react";
import type { ProviderVolume } from "@/server/queries/analytics";

interface Props {
  data: ProviderVolume[];
}

export function ProviderVolumeChart({ data }: Props) {
  return (
    <Card
      style={{ animation: "fadeInUp 500ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both" }}
    >
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Layers className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">Volumen de RMAs por proveedor</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Sin RMAs
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ left: 20 }} barCategoryGap="25%">
              <XAxis
                dataKey="providerName"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "hsl(var(--popover-foreground))" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Bar
                dataKey="open"
                name="Abiertos"
                stackId="a"
                fill="#ff592f"
                animationBegin={200}
                animationDuration={800}
              />
              <Bar
                dataKey="closed"
                name="Cerrados"
                stackId="a"
                fill="#02995d"
                animationBegin={300}
                animationDuration={800}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="cancelled"
                name="Cancelados"
                stackId="a"
                fill="#f50a48"
                animationBegin={400}
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
