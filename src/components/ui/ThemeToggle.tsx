"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-2",
        "border border-[var(--border)]",
        "bg-[var(--surface)] text-[var(--text)]",
        "hover:bg-[var(--surface-secondary)]",
        "transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2",
        "dark:focus:ring-offset-[var(--background)]",
      )}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
