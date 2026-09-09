"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronRight, Menu, LogOut, Settings, User } from "lucide-react";
import { signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { getDoc, doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import NotificationBell from "@/components/admin/NotificationBell";
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
  const { currentUser, isLoading: authLoading } = useAuth();
  const crumbs = buildBreadcrumb(pathname);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingDriverCount, setPendingDriverCount] = useState(0);
  const [pendingFeeCount, setPendingFeeCount] = useState(0);
  const [dynamicCrumbs, setDynamicCrumbs] = useState<Record<string, string>>({});
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const adminName = currentUser?.fullName?.trim() || "Admin";
  const adminEmail = currentUser?.email?.trim() || "admin@tosms.com";
  const adminPhotoUrl =
    currentUser?.profileImageUrl ||
    (currentUser as any)?.photoURL ||
    (currentUser as any)?.profilePhoto ||
    (currentUser as any)?.photoUrl ||
    (currentUser as any)?.avatarUrl;

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
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setPendingDriverCount(0);
      return;
    }

    const unsubscribeDrivers = onSnapshot(
      query(
        collection(db, COLLECTIONS.USERS),
        where("role", "==", "driver"),
        where("approved", "==", false),
      ),
      (snapshot) => {
        const readyForApproval = snapshot.docs.filter((userDoc) => {
          const data = userDoc.data() as { profileComplete?: boolean; status?: string };
          return data.profileComplete === true && data.status !== "rejected";
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
  }, [authLoading, currentUser]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length >= 3 && segments[1] === "reviews") {
      const driverId = segments[2];
      if (driverId && !dynamicCrumbs[driverId]) {
        getDoc(doc(db, COLLECTIONS.USERS, driverId))
          .then((snap) => {
            if (snap.exists()) {
              setDynamicCrumbs((prev) => ({ ...prev, [driverId]: snap.data().fullName || driverId }));
            }
          })
          .catch(console.error);
      }
    }
  }, [pathname, dynamicCrumbs]);

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
                  {dynamicCrumbs[pathname.split("/").filter(Boolean)[index]] || crumb}
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
          <NotificationBell />

          {/* Admin Avatar and Dropdown Container with Hover Trigger */}
          <div
            ref={profileMenuRef}
            className="relative"
            onMouseEnter={() => setShowProfileMenu(true)}
            onMouseLeave={() => setShowProfileMenu(false)}
          >
            <button
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                "hover:bg-[var(--surface-secondary)]",
                "transition-colors duration-200",
              )}
            >
              {adminPhotoUrl ? (
                <Image
                  src={adminPhotoUrl}
                  alt={adminName}
                  width={32}
                  height={32}
                  unoptimized
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-blue-500/20"
                />
              ) : (
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full",
                    "bg-[var(--primary)]/20 text-[var(--primary)]",
                    "h-8 w-8 text-sm font-semibold",
                  )}
                >
                  {adminInitials}
                </div>
              )}
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
                  "absolute right-0 top-full pt-1.5 w-52 z-50",
                )}
              >
                <div
                  className={cn(
                    "rounded-xl border",
                    "border-[var(--border)]",
                    "bg-[var(--surface)]",
                    "shadow-xl",
                    "overflow-hidden",
                  )}
                >
                  <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-secondary)]/50">
                    <div className="flex items-center gap-3">
                      {adminPhotoUrl ? (
                        <Image
                          src={adminPhotoUrl}
                          alt={adminName}
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="flex items-center justify-center rounded-full bg-[var(--primary)] text-white h-10 w-10 text-sm font-semibold">
                          {adminInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">
                          {adminName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {adminEmail}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      href="/dashboard/notifications"
                      onClick={() => setShowProfileMenu(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg",
                        "text-[var(--text)] hover:bg-[var(--surface-secondary)]",
                        "transition-colors duration-200 text-sm font-medium",
                      )}
                    >
                      <Bell className="h-4 w-4 text-blue-500" />
                      Notifications
                      {notificationCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 bg-[var(--error)] text-white rounded-full text-xs font-bold">
                          {notificationCount > 99 ? "99+" : notificationCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg",
                        "text-[var(--text)] hover:bg-[var(--surface-secondary)]",
                        "transition-colors duration-200 text-sm font-medium",
                      )}
                    >
                      <User className="h-4 w-4 text-emerald-500" />
                      Admin Profile
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setShowProfileMenu(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg",
                        "text-[var(--text)] hover:bg-[var(--surface-secondary)]",
                        "transition-colors duration-200 text-sm font-medium",
                      )}
                    >
                      <Settings className="h-4 w-4 text-purple-500" />
                      Settings
                    </Link>
                  </div>
                  <div className="border-t border-[var(--border)] p-1.5">
                    <button
                      onClick={() => void handleLogout()}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg",
                        "text-[var(--error)] hover:bg-[var(--error-light)] dark:hover:bg-[var(--error)]/20",
                        "transition-colors duration-200 text-sm font-medium",
                      )}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
