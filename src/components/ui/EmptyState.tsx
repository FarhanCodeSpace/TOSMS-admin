"use client";

import Link from "next/link";
import { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionHref?: string | { pathname: string; query?: Record<string, string> };
  onAction?: () => void;
};

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
        {icon}
      </div>
      <h3 className="mt-6 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      {actionLabel ? (
        actionHref ? (
          <Link
            href={actionHref as any}
            className="mt-6 inline-flex rounded-full bg-[#1A3C5E] px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 inline-flex rounded-full bg-[#1A3C5E] px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            {actionLabel}
          </button>
        )
      ) : null}
    </div>
  );
}
