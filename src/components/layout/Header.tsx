"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronRight, Menu, LogOut, Settings, User } from "lucide-react";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";

function buildBreadcrumb(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["Dashboard"];
  return ["Dashboard", ...segments.slice(1)].map((segment) =>
    segment
      .replace(/-/g, " ")
      .replace(/([A-Z])/g, " $1")
      .trim(),
  );
}

interface HeaderProps {
  onToggleMobileMenu: () => void;
}

export default function Header({ onToggleMobileMenu }: HeaderProps) {
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const { currentUser } = useAuth();
  const crumbs = buildBreadcrumb(pathname);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingDriverCount, setPendingDriverCount] = useState(0);
  const [pendingFeeCount, setPendingFeeCount] = useState(0);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const adminName = currentUser?.fullName?.trim() || "Admin";
  const adminEmail = currentUser?.email?.trim() || "admin@tosms.com";
  const adminInitials = useMemo(() => {
    const parts = adminName
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) return "AD";
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [adminName]);

  const notificationCount = pendingDriverCount + pendingFeeCount;

  useEffect(() => {
    const unsubscribeDrivers = onSnapshot(
      query(
        collection(db, COLLECTIONS.USERS),
        where("role", "==", "driver"),
        where("approved", "==", false),
      ),
      (snapshot) => {
        const readyForApproval = snapshot.docs.filter((userDoc) => {
          const data = userDoc.data() as { profileComplete?: boolean };
          return data.profileComplete === true;
        });
        setPendingDriverCount(readyForApproval.length);
      },
      () => {
        setPendingDriverCount(0);
      },
    );

    const unsubscribeFees = onSnapshot(
      query(
        collection(db, COLLECTIONS.FEE_PAYMENTS),
        where("paymentStatus", "==", "submitted"),
      ),
      (snapshot) => {
        setPendingFeeCount(snapshot.size);
      },
      () => {
        setPendingFeeCount(0);
      },
    );

    return () => {
      unsubscribeDrivers();
      unsubscribeFees();
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!showProfileMenu) return;
      const target = event.target as Node;
      if (profileMenuRef.current?.contains(target)) return;
      setShowProfileMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showProfileMenu]);

  useEffect(() => {
    setShowProfileMenu(false);
  }, [pathname]);

  const handleNotificationsAction = () => {
    router.push("/dashboard/notifications");
  };

  const handleLogout = () => {
    document.cookie = "tosms_admin_auth=; path=/; max-age=0";
    router.replace("/login");
    void signOut(auth).catch((error) => {
      console.error("Logout failed:", error);
    });
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-20 h-16 border-b",
        "border-[var(--border)]",
        "bg-[var(--surface)]",
        "text-[var(--text)]",
        "shadow-sm",
      )}
    >
      <div className="flex items-center justify-between h-full px-6 gap-4">
        {/* Left side: Menu and Breadcrumbs */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-lg",
              "border border-[var(--border)]",
              "bg-[var(--surface)]",
              "text-[var(--text)]",
              "hover:bg-[var(--surface-secondary)]",
              "transition-colors duration-200",
              "lg:hidden",
            )}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <nav className="hidden md:flex items-center gap-2 text-sm min-w-0">
            {crumbs.map((crumb, index) => (
              <div key={crumb} className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "truncate",
                    index === crumbs.length - 1
                      ? "font-semibold text-[var(--primary)]"
                      : "text-[var(--text-muted)]",
                  )}
                >
                  {crumb}
                </span>
                {index < crumbs.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-[var(--border-strong)] flex-shrink-0" />
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Right side: Actions */}
        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <button
            type="button"
            onClick={handleNotificationsAction}
            aria-label="Open notifications"
            className={cn(
              "relative inline-flex items-center justify-center h-10 w-10 rounded-lg",
              "text-[var(--text-muted)] hover:text-[var(--text)]",
              "hover:bg-[var(--surface-secondary)]",
              "transition-colors duration-200",
            )}
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span
                className={cn(
                  "absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] px-1 items-center justify-center",
                  "rounded-full bg-[var(--error)] text-white",
                  "text-xs font-bold",
                )}
              >
                {notificationCount > 99 ? "99+" : notificationCount}
              </span>
            )}
          </button>

          {/* Admin Avatar and Dropdown */}
          <div ref={profileMenuRef} className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                "hover:bg-[var(--surface-secondary)]",
                "transition-colors duration-200",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full",
                  "bg-[var(--primary)]/20 text-[var(--primary)]",
                  "h-8 w-8 text-sm font-semibold",
                )}
              >
                {adminInitials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-[var(--text)]">
                  {adminName}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{adminEmail}</p>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div
                className={cn(
                  "absolute right-0 mt-2 w-48 rounded-lg border",
                  "border-[var(--border)]",
                  "bg-[var(--surface)]",
                  "shadow-lg",
                  "z-50",
                )}
              >
                <div className="p-4 border-b border-[var(--border)]">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {adminName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {adminEmail}
                  </p>
                </div>
                <div className="py-2 space-y-1">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push("/dashboard/notifications");
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2",
                      "text-[var(--text)] hover:bg-[var(--surface-secondary)]",
                      "transition-colors duration-200 text-sm",
                    )}
                  >
                    <Bell className="h-4 w-4" />
                    Notifications
                    {notificationCount > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 bg-[var(--error)] text-white rounded-full text-xs font-bold">
                        {notificationCount > 99 ? "99+" : notificationCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push("/dashboard/settings");
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2",
                      "text-[var(--text)] hover:bg-[var(--surface-secondary)]",
                      "transition-colors duration-200 text-sm",
                    )}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push("/dashboard/settings");
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2",
                      "text-[var(--text)] hover:bg-[var(--surface-secondary)]",
                      "transition-colors duration-200 text-sm",
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>
                <div className="border-t border-[var(--border)] p-2">
                  <button
                    onClick={() => void handleLogout()}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2",
                      "text-[var(--error)] hover:bg-[var(--error-light)] dark:hover:bg-[var(--error)]/20",
                      "transition-colors duration-200 text-sm font-medium",
                    )}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
