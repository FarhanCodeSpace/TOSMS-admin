"use client";

import { Bell, ChevronRight, UserCircle } from "lucide-react";
import { usePathname } from "next/navigation";

function buildBreadcrumb(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["Dashboard"];
  return ["Dashboard", ...segments.slice(1)].map((segment) =>
    segment.replace(/-/g, " "),
  );
}

export default function Header() {
  const pathname = usePathname() ?? "/dashboard";
  const crumbs = buildBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        {crumbs.map((crumb, index) => (
          <span key={crumb} className="inline-flex items-center gap-2">
            <span
              className={
                index === crumbs.length - 1
                  ? "font-semibold text-slate-900"
                  : "text-slate-500"
              }
            >
              {crumb}
            </span>
            {index < crumbs.length - 1 ? (
              <ChevronRight className="h-4 w-4" />
            ) : null}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700 transition hover:border-slate-300"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
            3
          </span>
        </button>
        <div className="flex items-center gap-3 rounded-3xl bg-slate-50 px-3 py-2">
          <UserCircle className="h-9 w-9 text-slate-500" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Admin</p>
            <p className="text-xs text-slate-500">Transport Operations</p>
          </div>
        </div>
      </div>
    </header>
  );
}
