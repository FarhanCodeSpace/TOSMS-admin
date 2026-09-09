"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
  className?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  isLoading = false,
  className,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading) {
        onClose();
      }
    }

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, isLoading]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6",
        "bg-black/50 backdrop-blur-sm",
        "animate-fade-in",
      )}
      onClick={() => !isLoading && onClose()}
    >
      <div
        className={cn(
          "w-full max-w-2xl overflow-hidden rounded-xl",
          "bg-[var(--surface)] text-[var(--text)]",
          "shadow-2xl",
          "animate-slide-up",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => !isLoading && onClose()}
            disabled={isLoading}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full",
              "text-[var(--text-muted)] hover:text-[var(--text)]",
              "hover:bg-[var(--surface-secondary)]",
              "transition-colors duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4 bg-[var(--surface-secondary)]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
