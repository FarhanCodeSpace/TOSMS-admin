import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("pb-6 border-b border-[var(--border)]", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              <a
                href={crumb.href || "#"}
                className={cn(
                  "text-xs transition-colors duration-200",
                  index === breadcrumbs.length - 1
                    ? "text-[var(--primary)] font-medium"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                {crumb.label}
              </a>
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="w-4 h-4 text-[var(--border-strong)]" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
