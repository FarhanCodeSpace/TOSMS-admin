"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type ActivityFeedItem = {
  id: string;
  title: string;
  status: string;
  date?: Date | null;
  description?: string;
};

type ActivityFeedProps = {
  title: string;
  viewAllHref?: string | { pathname: string; query?: Record<string, string> };
  items: ActivityFeedItem[];
  emptyText?: string;
};

const statusDotClasses: Record<string, string> = {
  verified: "bg-emerald-500",
  submitted: "bg-amber-500",
  pending: "bg-amber-500",
  canceled: "bg-rose-500",
  rejected: "bg-rose-500",
  approved: "bg-emerald-500",
};

const statusLabelClasses: Record<string, string> = {
  verified: "bg-[var(--success-light)] text-[var(--success)]",
  submitted: "bg-[var(--warning-light)] text-[var(--warning)]",
  pending: "bg-[var(--warning-light)] text-[var(--warning)]",
  canceled: "bg-[var(--error-light)] text-[var(--error)]",
  rejected: "bg-[var(--error-light)] text-[var(--error)]",
  approved: "bg-[var(--success-light)] text-[var(--success)]",
};

export default function ActivityFeed({
  title,
  viewAllHref,
  items,
  emptyText = "No recent activity yet.",
}: ActivityFeedProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm",
        "transition-all duration-200",
      )}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref as any}
            className="text-sm font-medium text-[var(--primary)] transition hover:opacity-80"
          >
            View All
          </Link>
        ) : null}
      </div>

      <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] p-8 text-center text-sm text-[var(--text-muted)]">
            {emptyText}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex min-w-0 items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-4 transition-colors duration-200 hover:bg-[var(--surface-secondary)]"
            >
              <div className="mt-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] shadow-sm">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    statusDotClasses[item.status.toLowerCase()] ||
                    "bg-[var(--text-muted)]"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0 text-sm text-[var(--text-secondary)]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--text)] break-words">
                    {item.title}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      statusLabelClasses[item.status.toLowerCase()] ||
                        "bg-[var(--surface)] text-[var(--text-muted)]",
                    )}
                  >
                    {item.status}
                  </span>
                </div>
                {item.description ? (
                  <p className="mt-1 text-sm text-[var(--text-secondary)] break-words">
                    {item.description}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {item.date
                    ? formatDistanceToNow(item.date, { addSuffix: true })
                    : "just now"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export type { ActivityFeedItem };
