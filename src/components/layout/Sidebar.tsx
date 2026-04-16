"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Map,
  MapPin,
  Settings,
  Star,
  Users,
  GraduationCap,
  LogOut,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Routes", href: "/dashboard/routes", icon: MapPin },
  { label: "Drivers", href: "/dashboard/drivers", icon: Users },
  { label: "Students", href: "/dashboard/students", icon: GraduationCap },
  { label: "Availability", href: "/dashboard/availability", icon: Calendar },
  { label: "Fees", href: "/dashboard/fees", icon: CreditCard },
  { label: "Live Tracking", href: "/dashboard/live-tracking", icon: Map },
  { label: "Rides", href: "/dashboard/rides", icon: Bus },
  { label: "Reviews", href: "/dashboard/reviews", icon: Star },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export default function Sidebar({
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activePath = pathname ?? "/dashboard";

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "tosms_admin_auth=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-20 h-screen flex flex-col bg-[#1A3C5E] text-white shadow-xl transition-all duration-300 ${
        collapsed ? "w-20 px-2" : "w-64 px-3"
      }`}
    >
      <div className="py-4">
        <div
          className={`rounded-3xl border border-white/10 bg-white/5 text-center transition-all duration-300 ${
            collapsed ? "px-2 py-3" : "px-4 py-4"
          }`}
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-3xl bg-white/10 text-white">
            <Bus className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.24em]">
                Transport
              </p>
              <p className="text-[10px] text-white/70">Operations</p>
            </>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 py-2 min-h-0 overflow-hidden">
        {navItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? activePath === "/dashboard"
              : activePath === item.href ||
                activePath.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-medium transition ${
                active
                  ? "bg-white/10 text-white opacity-100 border-l-4 border-[#F5A623]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              } ${collapsed ? "justify-center border-none" : ""}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 py-4">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 ${
            collapsed ? "px-2 py-2" : "px-4 py-3 text-sm"
          }`}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>

        <div
          className={`rounded-2xl border border-white/10 bg-white/5 text-white/80 transition-all duration-300 ${
            collapsed ? "px-2 py-2" : "px-3 py-3"
          }`}
        >
          <p
            className={`font-semibold text-center ${collapsed ? "text-xs" : "text-sm"}`}
          >
            Admin
          </p>
          {!collapsed ? (
            <>
              <p className="mt-0.5 text-center text-xs text-white/60">
                Super Admin
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#F5A623] px-2 py-1.5 text-xs font-semibold text-[#1A3C5E] transition hover:bg-[#e0a220]"
              >
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5A623] text-[#1A3C5E] transition hover:bg-[#e0a220]"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
