"use client";

type SkeletonLoaderProps = {
  className?: string;
  rows?: number;
  variant?: "line" | "card" | "table";
};

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export default function SkeletonLoader({
  className,
  rows = 1,
  variant = "line",
}: SkeletonLoaderProps) {
  if (variant === "card") {
    return (
      <div
        className={cx(
          "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5",
          className,
        )}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-1/3 rounded bg-[var(--surface-secondary)]" />
          <div className="h-4 w-2/3 rounded bg-[var(--surface-secondary)]" />
          <div className="h-4 w-1/2 rounded bg-[var(--surface-secondary)]" />
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div
        className={cx(
          "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]",
          className,
        )}
      >
        <div className="animate-pulse border-b border-[var(--border)] bg-[var(--surface-secondary)] p-4">
          <div className="h-4 w-1/4 rounded bg-[var(--surface-secondary)]" />
        </div>
        <div className="animate-pulse space-y-3 p-4">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid grid-cols-12 gap-3">
              <div className="col-span-2 h-4 rounded bg-[var(--surface-secondary)]" />
              <div className="col-span-3 h-4 rounded bg-[var(--surface-secondary)]" />
              <div className="col-span-2 h-4 rounded bg-[var(--surface-secondary)]" />
              <div className="col-span-3 h-4 rounded bg-[var(--surface-secondary)]" />
              <div className="col-span-2 h-4 rounded bg-[var(--surface-secondary)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cx("animate-pulse space-y-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-4 rounded bg-[var(--surface-secondary)]"
        />
      ))}
    </div>
  );
}
