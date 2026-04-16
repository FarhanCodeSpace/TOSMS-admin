"use client";

import { ReactNode } from "react";

type StatsCardProps = {
  title: string;
  value: string | number;
  label: string;
  description?: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  footer?: ReactNode;
};

export default function StatsCard({
  title,
  value,
  label,
  description,
  icon,
  iconBg,
  iconColor,
  footer,
}: StatsCardProps) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div
        className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>

      <p className="min-h-[2.75rem] max-w-[calc(100%-4.5rem)] text-sm font-medium leading-5 text-gray-500 break-words">
        {title}
      </p>
      <p className="mt-6 text-[32px] font-bold text-[#1A3C5E]">{value}</p>
      <p className="mt-2 text-sm text-gray-500 break-words">{label}</p>
      {description ? (
        <p className="mt-3 text-sm text-slate-500 break-words">{description}</p>
      ) : null}
      {footer ? <div className="mt-5 break-words">{footer}</div> : null}
    </div>
  );
}
