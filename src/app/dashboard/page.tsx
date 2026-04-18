"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { addDays, format, subMonths } from "date-fns";
import { MapPin, Users, GraduationCap, Bus, Calendar } from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { useAuth } from "@/context/AuthContext";
import {
  isSubmittedForReview,
  isVerifiedPayment,
  normalizeFeeAmount,
} from "@/utils/feeHelpers";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import MetricTile from "@/components/ui/MetricTile";
import ActivityFeed from "@/components/ui/ActivityFeed";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { cn } from "@/lib/utils";

const today = new Date();
const todayString = format(today, "yyyy-MM-dd");
const todayDisplay = format(today, "EEEE, MMMM d, yyyy");
const currentMonthString = format(today, "yyyy-MM");

type RouteRecord = {
  routeId: string;
  routeName?: string;
  name?: string;
  isActive?: boolean;
  assignedDriverId?: string;
  studentIds?: string[];
};

type AvailabilityRecord = {
  routeId: string;
  userId: string;
  role: string;
  isAvailable: boolean;
  date: string;
};

type FeePaymentRecord = {
  id: string;
  paymentStatus: string;
  amount: number;
  month: string;
  submittedAt: Date | null;
  studentName: string;
  paymentMethod: string;
};

type AvailabilitySummary = {
  routeId: string;
  name: string;
  driverStatus: "available" | "unavailable" | "pending" | "unassigned";
  driverLabel: string;
  availableCount: number;
  notAvailableCount: number;
  noResponseCount: number;
  responseRate: number;
};

function formatPKR(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getMonthLabels(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = subMonths(new Date(), count - 1 - index);
    return {
      monthKey: format(date, "yyyy-MM"),
      monthLabel: format(date, "MMM yy"),
    };
  });
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--success)]">
        Collected: {formatPKR(payload[0]?.value ?? 0)}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const [availabilityView, setAvailabilityView] = useState<
    "today" | "tomorrow"
  >("today");
  const [activeRoutesCount, setActiveRoutesCount] = useState(0);
  const [activeDriversCount, setActiveDriversCount] = useState(0);
  const [pendingDriversCount, setPendingDriversCount] = useState(0);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);
  const [unassignedStudentsCount, setUnassignedStudentsCount] = useState(0);
  const [activeRidesCount, setActiveRidesCount] = useState(0);
  const [scheduledRidesCount, setScheduledRidesCount] = useState(0);
  const [routeRecords, setRouteRecords] = useState<RouteRecord[]>([]);
  const [availabilityRecords, setAvailabilityRecords] = useState<
    AvailabilityRecord[]
  >([]);
  const [feeTotalCollected, setFeeTotalCollected] = useState(0);
  const [feePendingCount, setFeePendingCount] = useState(0);
  const [feeVerifiedCount, setFeeVerifiedCount] = useState(0);
  const [feeChartData, setFeeChartData] = useState<
    { month: string; total: number }[]
  >([]);
  const [isFeeCardLoading, setIsFeeCardLoading] = useState(true);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(true);
  const [hasLoadedRoutes, setHasLoadedRoutes] = useState(false);
  const [hasLoadedAvailability, setHasLoadedAvailability] = useState(false);
  const [recentPayments, setRecentPayments] = useState<FeePaymentRecord[]>([]);

  const availabilityDateString = useMemo(
    () =>
      format(
        addDays(today, availabilityView === "tomorrow" ? 1 : 0),
        "yyyy-MM-dd",
      ),
    [availabilityView],
  );

  const availabilityDisplay = useMemo(
    () =>
      format(
        addDays(today, availabilityView === "tomorrow" ? 1 : 0),
        "EEEE, MMMM d, yyyy",
      ),
    [availabilityView],
  );

  useEffect(() => {
    setIsAvailabilityLoading(!(hasLoadedRoutes && hasLoadedAvailability));
  }, [hasLoadedRoutes, hasLoadedAvailability]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setActiveRoutesCount(0);
      setRouteRecords([]);
      setHasLoadedRoutes(true);
      return;
    }

    setHasLoadedRoutes(false);

    const activeRoutesQuery = query(
      collection(db, COLLECTIONS.ROUTES),
      where("isActive", "==", true),
    );

    const unsub = onSnapshot(
      activeRoutesQuery,
      (snapshot) => {
        setActiveRoutesCount(snapshot.size);
        setRouteRecords(
          snapshot.docs.map((doc) => {
            const data = doc.data() as RouteRecord;
            return {
              ...data,
              routeId: doc.id,
            };
          }),
        );
        setHasLoadedRoutes(true);
      },
      (error) => {
        console.error("Dashboard routes subscription failed:", error);
        setHasLoadedRoutes(true);
        toast.error("Unable to load routes on dashboard");
      },
    );

    return () => unsub();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setActiveDriversCount(0);
      setPendingDriversCount(0);
      return;
    }

    const driversQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "driver"),
    );

    const unsubscribe = onSnapshot(
      driversQuery,
      (snapshot) => {
        const drivers = snapshot.docs.map((driverDoc) =>
          driverDoc.data(),
        ) as Array<{
          status?: string;
          approved?: boolean;
          profileComplete?: boolean;
        }>;

        const activeDrivers = drivers.filter(
          (driver) => driver.status === "active",
        ).length;

        const pendingDrivers = drivers.filter(
          (driver) =>
            driver.approved === false && driver.profileComplete === true,
        ).length;

        setActiveDriversCount(activeDrivers);
        setPendingDriversCount(pendingDrivers);
      },
      (error) => {
        console.error("Dashboard drivers subscription failed:", error);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setTotalStudentsCount(0);
      setUnassignedStudentsCount(0);
      return;
    }

    const studentsQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "student"),
    );

    const unsubStudents = onSnapshot(
      studentsQuery,
      (snapshot) => {
        let unassigned = 0;

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as { routeId?: string };
          if (!data.routeId) {
            unassigned += 1;
          }
        });

        setTotalStudentsCount(snapshot.size);
        setUnassignedStudentsCount(unassigned);
      },
      (error) => {
        console.error("Dashboard students subscription failed:", error);
      },
    );

    return () => unsubStudents();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setActiveRidesCount(0);
      setScheduledRidesCount(0);
      return;
    }

    const activeRidesQuery = query(
      collection(db, COLLECTIONS.RIDES),
      where("status", "==", "active"),
      where("date", "==", todayString),
    );

    const scheduledRidesQuery = query(
      collection(db, COLLECTIONS.RIDES),
      where("status", "==", "scheduled"),
      where("date", "==", todayString),
    );

    const unsubActiveRides = onSnapshot(
      activeRidesQuery,
      (snapshot) => {
        setActiveRidesCount(snapshot.size);
      },
      (error) => {
        console.error("Dashboard active rides subscription failed:", error);
      },
    );
    const unsubScheduledRides = onSnapshot(
      scheduledRidesQuery,
      (snapshot) => {
        setScheduledRidesCount(snapshot.size);
      },
      (error) => {
        console.error("Dashboard scheduled rides subscription failed:", error);
      },
    );

    return () => {
      unsubActiveRides();
      unsubScheduledRides();
    };
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setAvailabilityRecords([]);
      setHasLoadedAvailability(true);
      return;
    }

    setHasLoadedAvailability(false);
    setAvailabilityRecords([]);

    const availabilityQuery = query(
      collection(db, COLLECTIONS.AVAILABILITY),
      where("date", "==", availabilityDateString),
    );

    const unsubAvailability = onSnapshot(
      availabilityQuery,
      (snapshot) => {
        setAvailabilityRecords(
          snapshot.docs.map((doc) => doc.data() as AvailabilityRecord),
        );
        setHasLoadedAvailability(true);
      },
      (error) => {
        console.error("Dashboard availability subscription failed:", error);
        setHasLoadedAvailability(true);
      },
    );

    return () => unsubAvailability();
  }, [authLoading, currentUser, availabilityDateString]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setFeeTotalCollected(0);
      setFeePendingCount(0);
      setFeeVerifiedCount(0);
      setFeeChartData([]);
      setIsFeeCardLoading(false);
      return;
    }

    setIsFeeCardLoading(true);
    const allFeesQuery = collection(db, COLLECTIONS.FEE_PAYMENTS);

    const unsubFees = onSnapshot(
      allFeesQuery,
      (snapshot) => {
        const payments = snapshot.docs.map((feeDoc) => {
          const data = feeDoc.data() as {
            fareAmount?: number;
            amount?: number;
            paymentStatus?: string;
            month?: string;
            feeExempt?: boolean;
          };

          return {
            ...data,
            amountValue: normalizeFeeAmount(data),
            month: data.month ?? "",
            paymentStatus: data.paymentStatus,
            feeExempt: data.feeExempt === true,
          };
        });

        const currentMonthPayments = payments.filter(
          (payment) => payment.month === currentMonthString,
        );

        let collected = 0;
        let pending = 0;
        let verified = 0;

        currentMonthPayments.forEach((payment) => {
          if (isVerifiedPayment(payment)) {
            collected += payment.amountValue;
            verified += 1;
          }

          if (isSubmittedForReview(payment)) {
            pending += 1;
          }
        });

        setFeeTotalCollected(collected);
        setFeePendingCount(pending);
        setFeeVerifiedCount(verified);

        const monthTotals = new Map<string, number>();
        payments.forEach((payment) => {
          if (!isVerifiedPayment(payment)) {
            return;
          }

          monthTotals.set(
            payment.month,
            (monthTotals.get(payment.month) || 0) + payment.amountValue,
          );
        });

        const chartSeries = getMonthLabels(6).map(
          ({ monthKey, monthLabel }) => ({
            month: monthLabel,
            total: monthTotals.get(monthKey) || 0,
          }),
        );

        setFeeChartData(chartSeries);
        setIsFeeCardLoading(false);
      },
      (error) => {
        console.error("Dashboard fees subscription failed:", error);
        setIsFeeCardLoading(false);
      },
    );

    return () => {
      unsubFees();
    };
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setRecentPayments([]);
      return;
    }

    const recentQuery = query(
      collection(db, COLLECTIONS.FEE_PAYMENTS),
      orderBy("submittedAt", "desc"),
      limit(8),
    );

    const unsubRecent = onSnapshot(
      recentQuery,
      (snapshot) => {
        setRecentPayments(
          snapshot.docs
            .map((doc) => {
              const data = doc.data() as {
                paymentStatus?: string;
                fareAmount?: number;
                amount?: number;
                month?: string;
                submittedAt?: { toDate?: () => Date } | Date;
                studentName?: string;
                paymentMethod?: string;
                feeExempt?: boolean;
              };

              const submittedAtRaw = data.submittedAt as any;
              const submittedAt = submittedAtRaw?.toDate
                ? submittedAtRaw.toDate()
                : submittedAtRaw instanceof Date
                  ? submittedAtRaw
                  : null;

              return {
                id: doc.id,
                paymentStatus: data.paymentStatus ?? "submitted",
                amount: Number(data.amount ?? data.fareAmount ?? 0),
                month: data.month ?? "Unknown",
                submittedAt,
                studentName: data.studentName ?? "Student",
                paymentMethod: data.paymentMethod ?? "payment",
                feeExempt: data.feeExempt === true,
              };
            })
            .filter((payment) => !payment.feeExempt),
        );
      },
      (error) => {
        console.error("Dashboard recent activity subscription failed:", error);
      },
    );

    return () => unsubRecent();
  }, [authLoading, currentUser]);

  const availabilitySummary = useMemo<AvailabilitySummary[]>(() => {
    return routeRecords.map((route) => {
      const studentsInRoute = route.studentIds?.length ?? 0;
      const studentResponses = availabilityRecords.filter(
        (record) =>
          record.routeId === route.routeId && record.role === "student",
      );

      const availableCount = studentResponses.filter(
        (record) => record.isAvailable,
      ).length;
      const notAvailableCount = studentResponses.filter(
        (record) => !record.isAvailable,
      ).length;
      const respondedCount = availableCount + notAvailableCount;
      const noResponseCount = Math.max(studentsInRoute - respondedCount, 0);

      const driverAvailability = availabilityRecords.find(
        (record) =>
          record.role === "driver" &&
          record.routeId === route.routeId &&
          route.assignedDriverId &&
          record.userId === route.assignedDriverId,
      );

      const driverStatus = route.assignedDriverId
        ? driverAvailability
          ? driverAvailability.isAvailable
            ? "available"
            : "unavailable"
          : "pending"
        : "unassigned";

      const driverLabel = route.assignedDriverId
        ? driverAvailability
          ? driverAvailability.isAvailable
            ? "Driver available"
            : "Driver unavailable"
          : "Driver response pending"
        : "No driver assigned";

      return {
        routeId: route.routeId,
        name: route.routeName ?? route.name ?? "Unnamed Route",
        driverStatus,
        driverLabel,
        availableCount,
        notAvailableCount,
        noResponseCount,
        responseRate:
          studentsInRoute > 0
            ? Math.round((respondedCount / studentsInRoute) * 100)
            : 0,
      };
    });
  }, [availabilityRecords, routeRecords]);

  const activeRoutesWithAssignedDriver = useMemo(
    () =>
      routeRecords.filter((route) => Boolean(route.assignedDriverId)).length,
    [routeRecords],
  );

  const routesIndicatorPercent =
    activeRoutesCount > 0
      ? Math.round((activeRoutesWithAssignedDriver / activeRoutesCount) * 100)
      : 0;

  const driversIndicatorPercent =
    activeDriversCount + pendingDriversCount > 0
      ? Math.round(
          (activeDriversCount / (activeDriversCount + pendingDriversCount)) *
            100,
        )
      : 0;

  const studentsIndicatorPercent =
    totalStudentsCount > 0
      ? Math.round(
          ((totalStudentsCount - unassignedStudentsCount) /
            totalStudentsCount) *
            100,
        )
      : 0;

  const ridesIndicatorPercent =
    activeRidesCount + scheduledRidesCount > 0
      ? Math.round(
          (activeRidesCount / (activeRidesCount + scheduledRidesCount)) * 100,
        )
      : 0;

  return (
    <div className="min-h-screen bg-[var(--background)] animate-fade-in">
      <div className="mx-auto max-w-7xl space-y-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text)]">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {todayDisplay}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse-dot" />
            <span className="text-sm font-semibold text-[var(--success)]">
              Live
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              updates enabled
            </span>
          </div>
        </div>

        {/* Stats Cards Row */}
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 animate-slide-up">
          <MetricTile
            title="Active Routes"
            value={activeRoutesCount}
            icon={<MapPin className="h-5 w-5" />}
            subtitle={`${activeRoutesWithAssignedDriver} with assigned driver`}
            trend={activeRoutesCount > 0 ? "up" : "neutral"}
            indicatorPercent={routesIndicatorPercent}
          />
          <MetricTile
            title="Total Drivers"
            value={activeDriversCount}
            icon={<Users className="h-5 w-5" />}
            subtitle={`${pendingDriversCount} pending approval`}
            trend={pendingDriversCount > 0 ? "down" : "up"}
            indicatorPercent={driversIndicatorPercent}
          />
          <MetricTile
            title="Total Students"
            value={totalStudentsCount}
            icon={<GraduationCap className="h-5 w-5" />}
            subtitle={`${unassignedStudentsCount} unassigned`}
            trend={unassignedStudentsCount > 0 ? "down" : "up"}
            indicatorPercent={studentsIndicatorPercent}
          />
          <MetricTile
            title="Active Rides"
            value={activeRidesCount}
            icon={<Bus className="h-5 w-5" />}
            subtitle={`${scheduledRidesCount} scheduled`}
            trend={activeRidesCount > 0 ? "up" : "neutral"}
            indicatorPercent={ridesIndicatorPercent}
          />
        </section>

        {/* Availability Overview */}
        <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <Card variant="elevated" className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                  {availabilityView === "today"
                    ? "Today's Availability"
                    : "Tomorrow's Availability"}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {availabilityDisplay}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-full border border-[var(--border)] p-1 bg-[var(--surface-secondary)]">
                  <button
                    type="button"
                    onClick={() => setAvailabilityView("today")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      availabilityView === "today"
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityView("tomorrow")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      availabilityView === "tomorrow"
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Tomorrow
                  </button>
                </div>
              </div>
            </div>

            {isAvailabilityLoading ? (
              <div className="space-y-3">
                <SkeletonLoader rows={1} className="h-4 w-1/3" />
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--surface-secondary)] border-b border-[var(--border)]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">
                          Route
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">
                          Driver
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)]">
                          Available
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)]">
                          Unavailable
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)]">
                          Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 3 }).map((_, index) => (
                        <tr
                          key={index}
                          className="border-b border-[var(--border)]"
                        >
                          <td className="px-4 py-4">
                            <SkeletonLoader className="h-4 w-28" />
                          </td>
                          <td className="px-4 py-4">
                            <SkeletonLoader className="h-6 w-36 rounded-full" />
                          </td>
                          <td className="px-4 py-4">
                            <SkeletonLoader className="mx-auto h-4 w-8" />
                          </td>
                          <td className="px-4 py-4">
                            <SkeletonLoader className="mx-auto h-4 w-8" />
                          </td>
                          <td className="px-4 py-4">
                            <SkeletonLoader className="ml-auto h-4 w-20" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : availabilitySummary.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] p-8 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  No active routes available for this date.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
                <table className="w-full min-w-[760px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[var(--surface-secondary)] border-b border-[var(--border)]">
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Route Name
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Driver Status
                      </th>
                      <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Available
                      </th>
                      <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Unavailable
                      </th>
                      <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        No Response
                      </th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Response Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {availabilitySummary.map((route, idx) => (
                      <tr
                        key={route.routeId}
                        className={cn(
                          "border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-secondary)]",
                          idx % 2 === 1 && "bg-[var(--surface-secondary)]/35",
                        )}
                      >
                        <td className="px-5 py-4 text-sm font-medium text-[var(--text)]">
                          {route.name}
                        </td>
                        <td className="px-5 py-4">
                          <Badge status={route.driverStatus}>
                            {route.driverLabel}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-center text-sm font-semibold text-[var(--success)]">
                          {route.availableCount}
                        </td>
                        <td className="px-5 py-4 text-center text-sm font-semibold text-[var(--error)]">
                          {route.notAvailableCount}
                        </td>
                        <td className="px-5 py-4 text-center text-sm text-[var(--text-muted)]">
                          {route.noResponseCount}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="h-2.5 w-28 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--success)]"
                                style={{ width: `${route.responseRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-[var(--text-secondary)] min-w-fit">
                              {route.responseRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
          {/* Fee Collection */}
          <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
            <Card variant="elevated">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                    Fee Collection
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {format(today, "MMMM yyyy")}
                  </p>
                </div>
                <Link
                  href={{
                    pathname: "/dashboard/fees",
                    query: { tab: "pending" },
                  }}
                >
                  <Button variant="secondary" size="sm">
                    Review pending
                  </Button>
                </Link>
              </div>

              {isFeeCardLoading ? (
                <div className="grid gap-4 sm:grid-cols-3 mb-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonLoader
                      key={i}
                      variant="card"
                      className="rounded-lg p-4 h-24"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3 mb-6">
                  <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--primary)]/10 to-[var(--surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Total Collected
                    </p>
                    <p className="mt-3 text-2xl font-bold text-[var(--primary)]">
                      {formatPKR(feeTotalCollected)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--warning)]/10 to-[var(--surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
                      Pending Reviews
                    </p>
                    <p className="mt-3 text-2xl font-bold text-[var(--warning)]">
                      {feePendingCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--success)]/10 to-[var(--surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--success)]">
                      Verified
                    </p>
                    <p className="mt-3 text-2xl font-bold text-[var(--success)]">
                      {feeVerifiedCount}
                    </p>
                  </div>
                </div>
              )}

              {isFeeCardLoading ? (
                <div className="h-72 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <div className="animate-pulse h-full space-y-4">
                    <div className="h-4 w-36 rounded bg-[var(--surface)]" />
                    <div className="h-[240px] rounded-2xl bg-[var(--surface)]/80" />
                  </div>
                </div>
              ) : (
                <div className="h-72 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={feeChartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="revenueGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="var(--primary)"
                            stopOpacity={0.32}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--primary)"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="4 6"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<RevenueTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        fill="url(#revenueGradient)"
                        dot={{ r: 3, fill: "var(--primary)" }}
                        activeDot={{
                          r: 5,
                          stroke: "var(--surface)",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 self-start">
            <div
              className="animate-slide-up"
              style={{ animationDelay: "300ms" }}
            >
              <ActivityFeed
                title="Recent Activity"
                items={recentPayments.map((payment) => ({
                  id: payment.id,
                  title: `${payment.studentName} submitted ${payment.month} fee`,
                  status: payment.paymentStatus,
                  date: payment.submittedAt,
                }))}
                emptyText="No recent activity found."
              />
            </div>
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "250ms" }}>
          <Card variant="elevated">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                  Quick Actions
                </h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Fast access to the most common admin actions
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Link
                href={{ pathname: "/dashboard/routes", query: { create: "1" } }}
              >
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-start"
                  leftIcon={<MapPin className="h-4 w-4" />}
                >
                  Create Route
                </Button>
              </Link>
              <Link
                href={{ pathname: "/dashboard/rides", query: { create: "1" } }}
              >
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-start"
                  leftIcon={<Bus className="h-4 w-4" />}
                >
                  Create Ride
                </Button>
              </Link>
              <Link
                href={{
                  pathname: "/dashboard/drivers",
                  query: { tab: "pending" },
                }}
              >
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-start"
                  leftIcon={<Users className="h-4 w-4" />}
                >
                  Approve Drivers
                  {pendingDriversCount > 0 && (
                    <Badge variant="warning" className="ml-auto">
                      {pendingDriversCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href={{ pathname: "/dashboard/availability" }}>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-start"
                  leftIcon={<Calendar className="h-4 w-4" />}
                >
                  View Availability
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
