"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle,
  Users,
  CreditCard,
  GraduationCap,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import EmptyState from "@/components/ui/EmptyState";
import NotificationCard from "@/components/notifications/NotificationCard";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type:
    | "driver-approval"
    | "student-approval"
    | "fee-payment"
    | "student-unassigned"
    | "route-alert";
  title: string;
  description: string;
  icon: typeof AlertCircle;
  severity: "critical" | "warning" | "info";
  timestamp: Date;
  actionLink?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  read: boolean;
}

interface PendingUser {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  profileComplete?: boolean;
}

interface PendingFee {
  id: string;
  studentName: string;
  studentId: string;
  amount: number;
  month: string;
  submittedAt: Date;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  // Fetch pending users (drivers and students)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.USERS),
        where("role", "in", ["driver", "student"]),
        where("approved", "==", false),
      ),
      (snapshot) => {
        const pendingUsers: PendingUser[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const isDriver = data.role === "driver";
          const isStudent = data.role === "student";
          
          if (data.status === "rejected") return;

          if ((isDriver && data.profileComplete === true) || isStudent) {
            pendingUsers.push({
              id: doc.id,
              fullName: data.fullName || (isDriver ? "Unknown Driver" : "Unknown Student"),
              email: data.email,
              phone: data.phone,
              role: data.role,
              profileComplete: data.profileComplete,
            });
          }
        });

        const approvalNotifications: Notification[] = pendingUsers.map(
          (user) => {
            const isStudent = user.role === "student";
            return {
              id: `${user.role}-${user.id}`,
              type: isStudent ? "student-approval" : "driver-approval",
              title: isStudent ? "Student Approval Pending" : "Driver Approval Pending",
              description: `${user.fullName} (${user.email}) is awaiting profile approval`,
              icon: Users,
              severity: "critical",
              timestamp: new Date(),
              actionLink: isStudent ? `/dashboard/students` : `/dashboard/drivers`,
              actionLabel: isStudent ? "Review Student" : "Review Driver",
              metadata: { userId: user.id, userName: user.fullName, role: user.role },
              read: false,
            };
          }
        );

        setNotifications((prev) => {
          const filtered = prev.filter((n) => n.type !== "driver-approval" && n.type !== "student-approval");
          return [...filtered, ...approvalNotifications];
        });
      },
      (error) => {
        console.error("Error fetching pending drivers:", error);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  // Fetch pending fee payments
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.FEE_PAYMENTS),
        where("paymentStatus", "==", "submitted"),
      ),
      (snapshot) => {
        const pendingFees: PendingFee[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          pendingFees.push({
            id: doc.id,
            studentName: data.studentName || "Unknown Student",
            studentId: data.studentId || "",
            amount: data.amount || 0,
            month: data.month || "Unknown Month",
            submittedAt: data.submittedAt?.toDate() || new Date(),
          });
        });

        const feeNotifications: Notification[] = pendingFees.map((fee) => ({
          id: `fee-${fee.id}`,
          type: "fee-payment",
          title: "Fee Payment Awaiting Verification",
          description: `${fee.studentName} submitted ${fee.month} fee (RS. ${fee.amount.toFixed(2)}) for verification`,
          icon: CreditCard,
          severity: "warning",
          timestamp: fee.submittedAt,
          actionLink: `/dashboard/fees?tab=pending`,
          actionLabel: "Verify Payment",
          metadata: {
            feeId: fee.id,
            studentId: fee.studentId,
            amount: fee.amount,
          },
          read: false,
        }));

        setNotifications((prev) => {
          const filtered = prev.filter((n) => n.type !== "fee-payment");
          return [...filtered, ...feeNotifications];
        });
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching pending fees:", error);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  // Fetch unassigned students
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.USERS),
        where("role", "==", "student"),
        where("assignedRouteId", "==", ""),
      ),
      (snapshot) => {
        const unassignedCount = snapshot.size;

        if (unassignedCount > 0) {
          const notification: Notification = {
            id: "unassigned-students",
            type: "student-unassigned",
            title: "Students Awaiting Route Assignment",
            description: `${unassignedCount} student${unassignedCount > 1 ? "s" : ""} ${unassignedCount > 1 ? "are" : "is"} not yet assigned to any route`,
            icon: GraduationCap,
            severity: "info",
            timestamp: new Date(),
            actionLink: `/dashboard/students`,
            actionLabel: "Assign Routes",
            metadata: { unassignedCount },
            read: false,
          };

          setNotifications((prev) => {
            const filtered = prev.filter(
              (n) => n.type !== "student-unassigned",
            );
            return [...filtered, notification];
          });
        } else {
          setNotifications((prev) =>
            prev.filter((n) => n.type !== "student-unassigned"),
          );
        }
      },
      (error) => {
        console.error("Error fetching unassigned students:", error);
      },
    );

    return unsubscribe;
  }, []);

  const filteredNotifications =
    filterType === "all"
      ? notifications
      : notifications.filter((n) => n.type === filterType);

  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    // Critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const severityDiff =
      severityOrder[a.severity as keyof typeof severityOrder] -
      severityOrder[b.severity as keyof typeof severityOrder];
    if (severityDiff !== 0) return severityDiff;
    // Then by timestamp (newest first)
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <SkeletonLoader variant="card" h-20 />
        <SkeletonLoader variant="card" h-20 />
        <SkeletonLoader variant="card" h-20 />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text)] mb-2">
            Notifications
          </h1>
          <p className="text-[var(--text-muted)]">
            Stay updated with important alerts and actions
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType("all")}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-all duration-200",
              filterType === "all"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-variant)] text-[var(--text)] hover:bg-[var(--surface-variant)]/80",
            )}
          >
            All Notifications
            {filterType === "all" && (
              <span className="ml-2 inline-block bg-white/20 px-2 py-0.5 rounded text-sm">
                {sortedNotifications.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterType("driver-approval")}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-all duration-200",
              filterType === "driver-approval"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-variant)] text-[var(--text)] hover:bg-[var(--surface-variant)]/80",
            )}
          >
            Driver Approvals
            {filterType === "driver-approval" && (
              <span className="ml-2 inline-block bg-white/20 px-2 py-0.5 rounded text-sm">
                {
                  notifications.filter((n) => n.type === "driver-approval")
                    .length
                }
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterType("student-approval")}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-all duration-200",
              filterType === "student-approval"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-variant)] text-[var(--text)] hover:bg-[var(--surface-variant)]/80",
            )}
          >
            Student Approvals
            {filterType === "student-approval" && (
              <span className="ml-2 inline-block bg-white/20 px-2 py-0.5 rounded text-sm">
                {
                  notifications.filter((n) => n.type === "student-approval")
                    .length
                }
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterType("fee-payment")}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-all duration-200",
              filterType === "fee-payment"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-variant)] text-[var(--text)] hover:bg-[var(--surface-variant)]/80",
            )}
          >
            Fee Payments
            {filterType === "fee-payment" && (
              <span className="ml-2 inline-block bg-white/20 px-2 py-0.5 rounded text-sm">
                {notifications.filter((n) => n.type === "fee-payment").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterType("student-unassigned")}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-all duration-200",
              filterType === "student-unassigned"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-variant)] text-[var(--text)] hover:bg-[var(--surface-variant)]/80",
            )}
          >
            Student Assignments
            {filterType === "student-unassigned" && (
              <span className="ml-2 inline-block bg-white/20 px-2 py-0.5 rounded text-sm">
                {
                  notifications.filter((n) => n.type === "student-unassigned")
                    .length
                }
              </span>
            )}
          </button>
        </div>

        {/* Notifications List */}
        {sortedNotifications.length > 0 ? (
          <div className="space-y-4">
            {sortedNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                title={notification.title}
                description={notification.description}
                icon={notification.icon}
                severity={notification.severity}
                timestamp={notification.timestamp}
                actionLink={notification.actionLink}
                actionLabel={notification.actionLabel}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CheckCircle className="w-8 h-8" />}
            title="All Caught Up!"
            subtitle="You have no pending notifications. Everything is running smoothly."
            actionLabel="Back to Dashboard"
            actionHref="/dashboard"
          />
        )}
      </div>
    </div>
  );
}
