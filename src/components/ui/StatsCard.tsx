"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  title: string;
  value: string | number;
  label: string;
  description?: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  footer?: ReactNode;
};

export default function StatsCard({
  title,
  value,
  label,
  description,
  icon,
  iconBg,
  iconColor,
  footer,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl border",
        "border-[var(--border)] bg-[var(--surface)]",
        "p-6 shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary)]/80 via-[var(--accent)]/70 to-[var(--success)]/70" />
      <div
        className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>

      <p className="min-h-[2.5rem] max-w-[calc(100%-4.5rem)] text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)] break-words">
        {title}
      </p>
      <p className="mt-5 text-[32px] font-extrabold tracking-tight text-[var(--primary)]">
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--text-secondary)] break-words">
        {label}
      </p>
      {description ? (
        <p className="mt-3 text-sm text-[var(--text-muted)] break-words">
          {description}
        </p>
      ) : null}
      {footer ? <div className="mt-5 break-words">{footer}</div> : null}
    </div>
  );
}
