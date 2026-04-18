"use client";

import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "neutral";

type MetricTileProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string | ReactNode;
  trend?: Trend;
  indicatorPercent?: number;
  className?: string;
  onClick?: () => void;
};

const trendStyles: Record<Trend, string> = {
  up: "text-[var(--success)] bg-[var(--success-light)]",
  down: "text-[var(--error)] bg-[var(--error-light)]",
  neutral: "text-[var(--text-muted)] bg-[var(--surface-secondary)]",
};

const TrendIcon = ({ trend }: { trend: Trend }) => {
  if (trend === "up") return <ArrowUpRight className="h-4 w-4" />;
  if (trend === "down") return <ArrowDownRight className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildIndicatorBars(percent: number) {
  const safe = clamp(percent, 0, 100);
  const anchor = clamp(18 + safe * 0.68, 18, 86);

  return [0.72, 0.84, 0.94, 1, 0.92, 0.8].map((multiplier) =>
    clamp(anchor * multiplier, 18, 100),
  );
}

export default function MetricTile({
  title,
  value,
  icon,
  subtitle,
  trend = "neutral",
  indicatorPercent = 0,
  className,
  onClick,
}: MetricTileProps) {
  const bars = buildIndicatorBars(indicatorPercent);

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative min-w-0 h-full overflow-hidden rounded-2xl border",
        "border-[var(--border)] bg-[var(--surface)]",
        "p-6 shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg",
        onClick && "cursor-pointer",
        className,
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary)]/80 via-[var(--accent)]/70 to-[var(--success)]/70" />

      <div className="flex h-full min-h-[220px] flex-col">
        {/* Header: Title + Icon */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="min-h-[2.5rem] text-sm font-semibold uppercase tracking-wide leading-tight text-[var(--text-muted)] max-w-[calc(100%-60px)]">
            {title}
          </h3>
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-secondary)] text-[var(--primary)] shadow-sm">
            {icon}
          </div>
        </div>

        {/* Main Value */}
        <div className="mb-2 min-h-[5rem] text-[42px] font-extrabold leading-none tracking-tight text-[var(--primary)]">
          {value}
        </div>

        {/* Subtitle / Sub-text */}
        <div className="mb-4 min-h-[1.25rem] text-xs text-[var(--text-muted)]">
          {subtitle ?? "\u00A0"}
        </div>

        {/* Footer: Trend + Indicator Bars */}
        <div className="mt-auto flex items-end justify-between gap-2">
          <div
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full",
              trendStyles[trend],
            )}
          >
            <TrendIcon trend={trend} />
          </div>

          <div className="flex h-8 items-end gap-1">
            {bars.map((bar, index) => (
              <span
                key={`${title}-${index}`}
                className="w-1.5 rounded-full bg-[var(--primary)]/70"
                style={{
                  height: `${Math.max(18, Math.min(100, bar))}%`,
                  opacity: 0.35 + index * 0.1,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
