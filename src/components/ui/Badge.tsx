"use client";

import { ReactNode } from "react";

type BadgeProps = {
  status: string;
  children?: ReactNode;
};

const badgeStyles: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  approved: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  available: "bg-emerald-100 text-emerald-700",
  exempt: "bg-violet-100 text-violet-700",
  pending: "bg-amber-100 text-amber-700",
  submitted: "bg-amber-100 text-amber-700",
  due: "bg-rose-100 text-rose-700",
  scheduled: "bg-sky-100 text-sky-700",
  unavailable: "bg-rose-100 text-rose-700",
  no_data: "bg-slate-100 text-slate-700",
  unassigned: "bg-slate-100 text-slate-700",
  declined: "bg-rose-100 text-rose-700",
};

export default function Badge({ status, children }: BadgeProps) {
  const normalized = status.toLowerCase();
  const classes = badgeStyles[normalized] ?? "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {children ?? status}
    </span>
  );
}
