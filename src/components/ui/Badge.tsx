"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BadgeProps {
  children?: ReactNode;
  status?: string;
  variant?:
    | "default"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "pending"
    | "active";
  className?: string;
  hasPulse?: boolean;
}

const statusVariantMap: Record<string, BadgeProps["variant"]> = {
  verified: "success",
  approved: "success",
  active: "active",
  available: "success",
  exempt: "info",
  pending: "pending",
  submitted: "warning",
  due: "error",
  scheduled: "info",
  unavailable: "error",
  no_data: "default",
  unassigned: "default",
  declined: "error",
};

export default function Badge({
  children,
  status,
  variant: propVariant,
  className,
  hasPulse,
}: BadgeProps) {
  const variant =
    propVariant ||
    (status ? statusVariantMap[status.toLowerCase()] || "default" : "default");

  const baseClasses =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium";

  const variantClasses = {
    default: "bg-[var(--surface-secondary)] text-[var(--text)]",
    success:
      "bg-[var(--success-light)] text-[var(--success)] dark:bg-[var(--success)]/20",
    warning:
      "bg-[var(--warning-light)] text-[var(--warning)] dark:bg-[var(--warning)]/20",
    error:
      "bg-[var(--error-light)] text-[var(--error)] dark:bg-[var(--error)]/20",
    info: "bg-[var(--primary-light)] text-[var(--primary)] dark:bg-[var(--primary)]/20",
    pending:
      "bg-[var(--warning-light)] text-[var(--warning)] dark:bg-[var(--warning)]/20",
    active:
      "bg-[var(--success-light)] text-[var(--success)] dark:bg-[var(--success)]/20",
  };

  const dotColor = {
    default: "bg-[var(--text-secondary)]",
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
    error: "bg-[var(--error)]",
    info: "bg-[var(--primary)]",
    pending: "bg-[var(--warning)]",
    active: "bg-[var(--success)]",
  };

  return (
    <span className={cn(baseClasses, variantClasses[variant], className)}>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          dotColor[variant],
          variant === "active" && hasPulse && "animate-pulse-dot",
        )}
      />
      {children ??
        (status
          ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
          : undefined)}
    </span>
  );
}
