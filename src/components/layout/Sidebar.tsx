"use client";

import Link from "next/link";
import { useEffect } from "react";
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
  Bell,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const navigationSections = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { label: "Routes", href: "/dashboard/routes", icon: MapPin },
      { label: "Drivers", href: "/dashboard/drivers", icon: Users },
      { label: "Students", href: "/dashboard/students", icon: GraduationCap },
      { label: "Rides", href: "/dashboard/rides", icon: Bus },
      {
        label: "Availability",
        href: "/dashboard/availability",
        icon: Calendar,
      },
    ],
  },
  {
    label: "FINANCIAL",
    items: [{ label: "Fees", href: "/dashboard/fees", icon: CreditCard }],
  },
  {
    label: "OTHER",
    items: [
      { label: "Live Tracking", href: "/dashboard/tracking", icon: Map },
      { label: "Reviews", href: "/dashboard/reviews", icon: Star },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigateStart?: () => void;
}

export default function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  onNavigateStart,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activePath = pathname ?? "/dashboard";

  useEffect(() => {
    const allRoutes = navigationSections.flatMap((section) =>
      section.items.map((item) => item.href),
    );

    allRoutes.forEach((href) => {
      router.prefetch(href as any);
    });
  }, [router]);

  const handleLogout = () => {
    document.cookie = "tosms_admin_auth=; path=/; max-age=0";
    router.replace("/login");
    void signOut(auth).catch((error) => {
      console.error("Logout failed:", error);
    });
  };

  const isActive = (href: string) => {
    return href === "/dashboard"
      ? activePath === "/dashboard"
      : activePath === href || activePath.startsWith(href + "/");
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-full border-r bg-[var(--surface)] text-[var(--text)] transition-all duration-300 ease-in-out flex flex-col",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo Section */}
        <div className="px-6 py-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1A3C5E] to-[#2563EB] rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-black text-sm">T</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-[var(--text)] font-bold text-base leading-tight">
                  TOSMS
                </h1>
                <p className="text-[#F5A623] text-[10px] font-medium leading-tight tracking-wide whitespace-nowrap">
                  Smart Transport, Safe Journey
                </p>
              </div>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="px-6 py-6">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Admin Portal
            </p>
            <div className="mt-3 h-px bg-[var(--border)]"></div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent">
          {navigationSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <h3 className="px-4 mb-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {section.label}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href as any}
                      onClick={() => {
                        if (!active) {
                          onNavigateStart?.();
                        }
                        if (mobileOpen) {
                          onCloseMobile();
                        }
                      }}
                      onMouseEnter={() => router.prefetch(item.href as any)}
                      onFocus={() => router.prefetch(item.href as any)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2",
                        "transition-all duration-200",
                        "text-sm font-medium",
                        active
                          ? cn(
                              "bg-[var(--primary-light)] dark:bg-[var(--primary)]/20",
                              "text-[var(--primary)]",
                              "border-l-2 border-[var(--primary)]",
                              "font-semibold",
                            )
                          : cn(
                              "text-[var(--text-secondary)]",
                              "hover:text-[var(--text)]",
                              "hover:bg-[var(--surface-secondary)]",
                            ),
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "border-t border-[var(--border)] p-3",
            collapsed && "space-y-2",
          )}
        >
          {/* Admin Info */}
          <div
            className={cn(
              "flex items-center gap-3",
              "rounded-xl border border-[var(--border)] px-3 py-3",
              collapsed && "justify-center",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-full",
                "border border-[var(--primary)]/30 ring-2 ring-[var(--primary)]/10",
                "bg-[var(--primary)]/20 text-[var(--primary)]",
                "font-semibold",
                collapsed ? "h-8 w-8 text-xs" : "h-10 w-10",
              )}
            >
              AD
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text)] truncate">
                  Admin
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  admin@tosms.com
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className={cn("space-y-1", !collapsed && "mt-3")}>
            <button
              onClick={onToggleCollapsed}
              className={cn(
                "w-full flex items-center justify-center gap-2",
                "px-3 py-2 rounded-md",
                "text-[var(--text-secondary)] hover:text-[var(--text)]",
                "hover:bg-[var(--surface-secondary)]",
                "transition-colors duration-200",
                "text-sm font-medium",
              )}
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

            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              leftIcon={<LogOut className="h-4 w-4" />}
              className={cn(
                "w-full justify-start",
                collapsed && "justify-center",
              )}
            >
              {!collapsed && "Logout"}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
