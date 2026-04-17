"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMonthDisplay } from "@/utils/dateHelpers";
import { formatPKR } from "@/utils/formatters";
import SkeletonLoader from "@/components/ui/SkeletonLoader";

type RevenueData = {
  month: string;
  collected: number;
  outstanding: number;
};

type RevenueChartProps = {
  data: RevenueData[];
  isLoading?: boolean;
};

export default function RevenueChart({ data, isLoading }: RevenueChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      name: formatMonthDisplay(item.month),
      Collected: item.collected,
      Outstanding: item.outstanding,
      month: item.month, // Keep original for reference
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg bg-white p-3 shadow-lg border border-slate-200">
          <p className="text-sm font-semibold text-slate-900">
            {payload[0].payload.name}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatPKR(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Monthly Revenue Trend
        </h3>
        <div className="animate-pulse">
          <div className="flex items-end justify-between gap-3 h-96 px-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div
                  className="w-full bg-slate-200 rounded-t"
                  style={{ height: `${Math.random() * 100 + 50}%` }}
                />
                <div className="h-3 w-12 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-6">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-4 w-24 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900 mb-6">
        Monthly Revenue Trend
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#64748b" }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="square"
            formatter={(value) =>
              value === "Collected" ? `Collected (✓)` : `Outstanding (×)`
            }
          />
          <Bar dataKey="Collected" fill="#10b981" radius={[8, 8, 0, 0]} />
          <Bar dataKey="Outstanding" fill="#ef4444" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
