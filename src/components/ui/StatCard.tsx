import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ReactNode } from "react";
import { Card } from "./Card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: number; label: string; direction: "up" | "down" };
  variant?: "primary" | "success" | "warning" | "error";
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = "primary",
  className,
}: StatCardProps) {
  const gradients = {
    primary:
      "from-[var(--primary)]/10 to-[var(--primary)]/5 dark:from-[var(--primary)]/20 dark:to-[var(--primary)]/10",
    success:
      "from-[var(--success)]/10 to-[var(--success)]/5 dark:from-[var(--success)]/20 dark:to-[var(--success)]/10",
    warning:
      "from-[var(--warning)]/10 to-[var(--warning)]/5 dark:from-[var(--warning)]/20 dark:to-[var(--warning)]/10",
    error:
      "from-[var(--error)]/10 to-[var(--error)]/5 dark:from-[var(--error)]/20 dark:to-[var(--error)]/10",
  };

  const iconBackgrounds = {
    primary: "bg-[var(--primary)]/20 text-[var(--primary)]",
    success: "bg-[var(--success)]/20 text-[var(--success)]",
    warning: "bg-[var(--warning)]/20 text-[var(--warning)]",
    error: "bg-[var(--error)]/20 text-[var(--error)]",
  };

  return (
    <Card
      variant="elevated"
      className={cn(
        `bg-gradient-to-br ${gradients[variant]} p-6`,
        "min-h-[210px]",
        className,
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header with icon and title */}
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            {title}
          </h3>
          <div className={cn("p-2.5 rounded-lg", iconBackgrounds[variant])}>
            {icon}
          </div>
        </div>

        {/* Large value */}
        <div className="pt-5">
          <p className="text-3xl font-bold text-[var(--primary)] dark:text-[var(--primary)]">
            {value}
          </p>
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex items-center gap-1">
              {trend.direction === "up" ? (
                <>
                  <TrendingUp className="w-4 h-4 text-[var(--success)]" />
                  <span className="text-sm font-medium text-[var(--success)]">
                    {trend.value}%
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-[var(--error)]" />
                  <span className="text-sm font-medium text-[var(--error)]">
                    {trend.value}%
                  </span>
                </>
              )}
            </div>
            <span className="text-sm text-[var(--text-muted)]">
              {trend.label}
            </span>
          </div>
        )}

        <div className="mt-auto pt-6">
          <div className="h-px w-full bg-[var(--border)]/60" />
        </div>
      </div>
    </Card>
  );
}
