"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DashboardChartPoint } from "./dashboard-data";

const chartConfig = {
  recorded: {
    label: "Logged",
    color: "var(--color-chart-1)",
  },
  exceptions: {
    label: "Exceptions",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

export default function DashboardAttendanceChart({
  data,
}: {
  data: DashboardChartPoint[];
}) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px]">
      <BarChart data={data} barGap={8} barCategoryGap={18} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={10} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="recorded"
          fill="var(--color-recorded)"
          radius={[6, 6, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="exceptions"
          fill="var(--color-exceptions)"
          radius={[6, 6, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ChartContainer>
  );
}
