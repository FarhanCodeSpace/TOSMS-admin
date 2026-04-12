"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

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

export default function ActivityFeed({
  title,
  viewAllHref,
  items,
  emptyText = "No recent activity yet.",
}: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref as any}
            className="text-sm font-medium text-sky-600 transition hover:text-sky-800"
          >
            View All
          </Link>
        ) : null}
      </div>

      <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            {emptyText}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex min-w-0 items-start gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
            >
              <span
                className={`mt-2 inline-block h-2.5 w-2.5 rounded-full ${
                  statusDotClasses[item.status.toLowerCase()] || "bg-slate-400"
                }`}
              />
              <div className="flex-1 min-w-0 text-sm text-slate-700">
                <p className="font-semibold text-slate-900 break-words">
                  {item.title}
                </p>
                {item.description ? (
                  <p className="mt-1 text-sm text-slate-500 break-words">
                    {item.description}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
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
