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
  HelpCircle,
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
      router.prefetch(href);
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
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 flex h-screen flex-col",
          "border-r border-[var(--border)]",
          "bg-[var(--surface)]",
          "text-[var(--text)]",
          "shadow-lg",
          "transition-all duration-300",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        {/* Logo Area */}
        <div
          className={cn(
            "flex items-center justify-between px-6 py-6",
            collapsed && "px-3",
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center rounded-lg",
                "bg-[var(--primary)] text-white",
                collapsed ? "h-10 w-10" : "h-12 w-12",
              )}
            >
              <Bus className={collapsed ? "w-5 h-5" : "w-6 h-6"} />
            </div>
            {!collapsed && (
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold text-[var(--primary)]">
                  TOSMS
                </span>
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]"></span>
              </div>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="px-6 pb-4">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Admin Portal
            </p>
            <div className="mt-3 h-px bg-[var(--border)]"></div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
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
                      href={item.href}
                      onClick={() => {
                        if (!active) {
                          onNavigateStart?.();
                        }
                        if (mobileOpen) {
                          onCloseMobile();
                        }
                      }}
                      onMouseEnter={() => router.prefetch(item.href)}
                      onFocus={() => router.prefetch(item.href)}
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
