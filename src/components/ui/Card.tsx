import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "default" | "elevated" | "bordered" | "glass";
  className?: string;
}

export function Card({ children, variant = "default", className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-6 transition-all duration-200",
        variant === "default" &&
          cn("bg-[var(--surface)]", "border border-[var(--border)]"),
        variant === "elevated" &&
          cn(
            "bg-[var(--surface)]",
            "border border-[var(--border)]",
            "shadow-md hover:shadow-lg",
            "transition-shadow duration-200",
          ),
        variant === "bordered" &&
          cn(
            "bg-transparent",
            "border-2 border-[var(--primary)]/20",
            "hover:border-[var(--primary)]/40",
            "transition-colors duration-200",
          ),
        variant === "glass" &&
          cn(
            "backdrop-blur-md",
            "bg-white/10 dark:bg-white/5",
            "border border-white/20 dark:border-white/10",
            "shadow-lg",
          ),
        className,
      )}
    >
      {children}
    </div>
  );
}
