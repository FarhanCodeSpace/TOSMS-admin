"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(8);
  const pathname = usePathname();
  const loadingTimeoutRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      window.clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const startRouteLoading = useCallback(() => {
    setIsRouteLoading(true);
    setLoadingProgress(12);
    clearProgressInterval();
    progressIntervalRef.current = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 88) return prev;
        const nextStep = prev < 45 ? 9 : prev < 70 ? 5 : 2;
        return Math.min(88, prev + nextStep);
      });
    }, 180);

    clearLoadingTimeout();
    loadingTimeoutRef.current = window.setTimeout(() => {
      clearProgressInterval();
      setLoadingProgress(100);
      setIsRouteLoading(false);
      loadingTimeoutRef.current = null;
    }, 9000);
  }, [clearLoadingTimeout, clearProgressInterval]);

  useEffect(() => {
    clearProgressInterval();
    setLoadingProgress(100);
    setIsRouteLoading(false);
    clearLoadingTimeout();

    const settleTimer = window.setTimeout(() => {
      setLoadingProgress(8);
    }, 260);

    return () => window.clearTimeout(settleTimer);
  }, [pathname, clearLoadingTimeout, clearProgressInterval]);

  useEffect(() => {
    const handleDocumentLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref) return;
      if (
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (nextUrl.origin !== currentUrl.origin) return;

      const nextRouteKey = `${nextUrl.pathname}${nextUrl.search}`;
      const currentRouteKey = `${currentUrl.pathname}${currentUrl.search}`;
      if (nextRouteKey === currentRouteKey) return;

      startRouteLoading();
    };

    document.addEventListener("click", handleDocumentLinkClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentLinkClick, true);
      clearLoadingTimeout();
      clearProgressInterval();
    };
  }, [clearLoadingTimeout, clearProgressInterval, startRouteLoading]);

  useEffect(() => {
    const warmUpQueries = async () => {
      const warmCollections = [
        COLLECTIONS.ROUTES,
        COLLECTIONS.USERS,
        COLLECTIONS.RIDES,
        COLLECTIONS.AVAILABILITY,
        COLLECTIONS.FEE_PAYMENTS,
      ];

      await Promise.all(
        warmCollections.map((name) =>
          getDocs(query(collection(db, name), limit(1))).catch(() => null),
        ),
      );
    };

    let cancelled = false;
    const runWarmUp = () => {
      if (!cancelled) {
        void warmUpQueries();
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const win = window as any;
      const idleId = win.requestIdleCallback(runWarmUp);

      return () => {
        cancelled = true;
        win.cancelIdleCallback(idleId);
      };
    }

    const fallbackTimer = setTimeout(runWarmUp, 700);
    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] transition-colors duration-300">
      {isRouteLoading && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] overflow-hidden bg-transparent">
          <div
            className="h-full bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--success)] transition-[width] duration-200 ease-out"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      )}

      <Sidebar
        collapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onNavigateStart={startRouteLoading}
      />

      <div
        className={`min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />
        <main className="min-h-[calc(100vh-4rem)] bg-[var(--background)] p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
