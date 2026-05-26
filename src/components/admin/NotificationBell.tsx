"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  Bell,
  CreditCard,
  Users,
  GraduationCap,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: "driver-approval" | "fee-payment" | "student-unassigned";
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  timestamp: Date;
  actionLink: string;
}

export default function NotificationBell() {
  const [drivers, setDrivers] = useState<NotificationItem[]>([]);
  const [fees, setFees] = useState<NotificationItem[]>([]);
  const [unassigned, setUnassigned] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch pending drivers
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "driver"),
      where("approved", "==", false),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: NotificationItem[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.profileComplete === true) {
            items.push({
              id: `driver-${doc.id}`,
              type: "driver-approval",
              title: "Driver Approval Pending",
              description: `${data.fullName || "Unknown Driver"} (${data.email || ""}) is awaiting profile approval`,
              severity: "critical",
              timestamp: new Date(),
              actionLink: "/dashboard/drivers",
            });
          }
        });
        setDrivers(items);
      },
      (error) => {
        console.error("Error fetching pending drivers:", error);
      }
    );
    return unsubscribe;
  }, []);

  // Fetch pending fee payments
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.FEE_PAYMENTS),
      where("paymentStatus", "==", "submitted"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: NotificationItem[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const submittedAt = data.submittedAt?.toDate() || new Date();
          const amount = data.amount || 0;
          items.push({
            id: `fee-${doc.id}`,
            type: "fee-payment",
            title: "Fee Payment Awaiting Verification",
            description: `${data.studentName || "Unknown Student"} submitted ${data.month || "Unknown Month"} fee (RS. ${amount.toFixed(2)}) for verification`,
            severity: "warning",
            timestamp: submittedAt,
            actionLink: "/dashboard/fees?tab=pending",
          });
        });
        setFees(items);
      },
      (error) => {
        console.error("Error fetching pending fees:", error);
      }
    );
    return unsubscribe;
  }, []);

  // Fetch unassigned students
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "student"),
      where("assignedRouteId", "==", ""),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const unassignedCount = snapshot.size;
        if (unassignedCount > 0) {
          setUnassigned([
            {
              id: "unassigned-students",
              type: "student-unassigned",
              title: "Students Awaiting Route Assignment",
              description: `${unassignedCount} student${unassignedCount > 1 ? "s" : ""} ${unassignedCount > 1 ? "are" : "is"} not yet assigned to any route`,
              severity: "info",
              timestamp: new Date(),
              actionLink: "/dashboard/students",
            },
          ]);
        } else {
          setUnassigned([]);
        }
      },
      (error) => {
        console.error("Error fetching unassigned students:", error);
      }
    );
    return unsubscribe;
  }, []);

  // Load read notification IDs from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("tosms_read_notifications");
      if (stored) {
        try {
          setReadIds(JSON.parse(stored));
        } catch (e) {
          console.error("Error parsing read notifications:", e);
        }
      }
    }
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Combine and sort notifications
  const notifications = useMemo(() => {
    const merged = [...drivers, ...fees, ...unassigned];
    return merged.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [drivers, fees, unassigned]);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  // Shake animation trigger for new notifications
  const prevUnreadCountRef = useRef(0);
  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!readIds.includes(notif.id)) {
      const updated = [...readIds, notif.id];
      setReadIds(updated);
      localStorage.setItem("tosms_read_notifications", JSON.stringify(updated));
    }
    setIsOpen(false);
    router.push(notif.actionLink);
  };

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    localStorage.setItem("tosms_read_notifications", JSON.stringify(allIds));
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "fee-payment":
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case "driver-approval":
        return <Users className="h-4 w-4 text-green-500" />;
      case "student-unassigned":
        return <GraduationCap className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-[var(--text-muted)]" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        animate={shouldShake ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.5 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors"
      >
        <Bell className="h-5 w-5 text-[var(--text-muted)]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--surface)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="font-semibold text-[var(--text)]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Bell className="h-12 w-12 text-[var(--text-muted)] opacity-20 mb-2" />
                  <p className="text-[var(--text-muted)] text-sm">
                    No new notifications
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "flex gap-3 p-4 hover:bg-[var(--surface-secondary)] cursor-pointer border-b border-[var(--border)] transition-colors relative",
                      !readIds.includes(notif.id) &&
                        "bg-[var(--surface-secondary)]/30 border-l-4 border-l-orange-500",
                    )}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)] truncate">
                        {notif.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                        {notif.description}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-2 opacity-70">
                        {notif.timestamp
                          ? formatDistanceToNow(notif.timestamp, {
                              addSuffix: true,
                            })
                          : "Just now"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
