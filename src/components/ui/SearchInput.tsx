import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { InputHTMLAttributes, useRef, useState } from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  onClear?: () => void;
}

export function SearchInput({
  placeholder = "Search...",
  value = "",
  onClear,
  onChange,
  className,
  ...props
}: SearchInputProps) {
  const [hasValue, setHasValue] = useState(!!value);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setHasValue(!!e.target.value);
    onChange?.(e);
  };

  const handleClear = () => {
    setHasValue(false);
    onClear?.();
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className={cn(
          "w-full pl-10 pr-10 py-2 rounded-full search-input",
          "bg-[var(--search-bg)] text-[var(--text)]",
          "border border-[var(--search-border)]",
          "placeholder:text-[var(--text-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2",
          "dark:focus:ring-offset-[var(--background)]",
          "transition-all duration-200",
          className,
        )}
        {...props}
      />
      {hasValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
