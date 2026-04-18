import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const baseClasses = cn(
    "inline-flex items-center justify-center gap-2",
    "font-medium rounded-lg",
    "transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2",
    "dark:focus:ring-offset-[var(--background)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "active:scale-95",
  );

  const variantClasses = {
    primary: cn(
      "bg-[var(--primary)] text-white",
      "hover:bg-[var(--primary)]/90",
      "active:scale-95",
    ),
    secondary: cn(
      "bg-[var(--surface-secondary)] text-[var(--text)]",
      "border border-[var(--border)]",
      "hover:border-[var(--border-strong)]",
    ),
    ghost: cn(
      "bg-transparent text-[var(--text)]",
      "hover:bg-[var(--surface-secondary)]",
    ),
    danger: cn("bg-[var(--error)] text-white", "hover:bg-[var(--error)]/90"),
    success: cn(
      "bg-[var(--success)] text-white",
      "hover:bg-[var(--success)]/90",
    ),
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!isLoading && leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
