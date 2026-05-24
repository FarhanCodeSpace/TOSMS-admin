"use client";

import { useEffect, useState, useRef } from "react";
import {
  Bell,
  CreditCard,
  UserCheck,
  CalendarCheck,
  AlertTriangle,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { AdminNotification } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: AdminNotification[] = [];
      let unread = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as AdminNotification;
        notifs.push({ ...data, id: doc.id });
        if (!data.read) unread++;
      });

      // Trigger shake animation if new unread notification arrives
      setUnreadCount((prev) => {
        if (unread > prev) {
          setShouldShake(true);
          setTimeout(() => setShouldShake(false), 500);
        }
        return unread;
      });

      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, []);

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

  const handleNotificationClick = async (notif: AdminNotification) => {
    if (!notif.read) {
      await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notif.id), {
        read: true,
      });
    }

    setIsOpen(false);

    switch (notif.type) {
      case "payment_submitted":
        router.push("/dashboard/fees");
        break;
      case "driver_pending":
        router.push("/dashboard/drivers");
        break;
      case "new_booking":
        // Assuming there might be a bookings page or relevant section
        router.push("/dashboard/rides");
        break;
      case "availability_alert":
        router.push("/dashboard/availability");
        break;
    }
  };

  const markAllRead = async () => {
    const batch = writeBatch(db);
    notifications
      .filter((n) => !n.read)
      .forEach((n) => {
        batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), { read: true });
      });
    await batch.commit();
  };

  const getIcon = (type: AdminNotification["type"]) => {
    switch (type) {
      case "payment_submitted":
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case "driver_pending":
        return <UserCheck className="h-4 w-4 text-green-500" />;
      case "new_booking":
        return <CalendarCheck className="h-4 w-4 text-purple-500" />;
      case "availability_alert":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Bell className="h-4 w-4" />;
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
                      !notif.read &&
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
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-2 opacity-70">
                        {notif.createdAt
                          ? formatDistanceToNow(notif.createdAt.toDate(), {
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
