"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
import { MapPin, Users, GraduationCap, Bus } from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { useAuth } from "@/context/AuthContext";
import {
  isSubmittedForReview,
  isVerifiedPayment,
  normalizeFeeAmount,
} from "@/utils/feeHelpers";
import StatsCard from "@/components/ui/StatsCard";
import ActivityFeed from "@/components/ui/ActivityFeed";
import Badge from "@/components/ui/Badge";
import SkeletonLoader from "@/components/ui/SkeletonLoader";

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      {/* Page Header */}
      <section>
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">{todayDisplay}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Live
          </div>
        </div>
      </section>

      {/* Stats Cards Row */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Routes"
          value={activeRoutesCount}
          label="Routes currently operating"
          icon={<MapPin className="h-5 w-5" />}
          iconBg="#DBEAFE"
          iconColor="#1A3C5E"
          footer={
            <p className="text-sm font-semibold text-green-700">
              All operational
            </p>
          }
        />
        <StatsCard
          title="Total Drivers"
          value={activeDriversCount}
          label="Drivers currently active"
          icon={<Users className="h-5 w-5" />}
          iconBg="#FEF3C7"
          iconColor="#92400E"
          footer={
            <Link
              href={{
                pathname: "/dashboard/drivers",
                query: { tab: "pending" },
              }}
              className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 transition hover:bg-amber-200"
            >
              {pendingDriversCount} pending approval
            </Link>
          }
        />
        <StatsCard
          title="Total Students"
          value={totalStudentsCount}
          label="Students enrolled"
          icon={<GraduationCap className="h-5 w-5" />}
          iconBg="#E2E8F0"
          iconColor="#1A3C5E"
          footer={
            <p className="text-sm text-gray-500">
              {unassignedStudentsCount} unassigned
            </p>
          }
        />
        <StatsCard
          title="Active Rides Today"
          value={activeRidesCount}
          label="Rides active today"
          icon={<Bus className="h-5 w-5" />}
          iconBg="#DBEAFE"
          iconColor="#1A3C5E"
          footer={
            <p className="text-sm font-semibold text-blue-700">
              {scheduledRidesCount} scheduled
            </p>
          }
        />
      </section>

      {/* Today's Availability Overview */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {availabilityView === "today"
                ? "Today's Availability Overview"
                : "Tomorrow's Availability Overview"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Route availability summary for {availabilityDisplay}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setAvailabilityView("today")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  availabilityView === "today"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setAvailabilityView("tomorrow")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  availabilityView === "tomorrow"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tomorrow
              </button>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Live
            </div>
          </div>
        </div>

        {isAvailabilityLoading ? (
          <div className="space-y-3">
            <SkeletonLoader rows={1} className="h-4 w-1/3" />
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Route Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Driver Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">
                      Available
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">
                      Not Available
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">
                      No Response
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                      Response Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index}>
                      <td className="px-4 py-4">
                        <SkeletonLoader className="h-4 w-28" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-6 w-36 animate-pulse rounded-full bg-slate-200" />
                      </td>
                      <td className="px-4 py-4">
                        <SkeletonLoader className="mx-auto h-4 w-8" />
                      </td>
                      <td className="px-4 py-4">
                        <SkeletonLoader className="mx-auto h-4 w-8" />
                      </td>
                      <td className="px-4 py-4">
                        <SkeletonLoader className="mx-auto h-4 w-8" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-200" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : availabilitySummary.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            No active routes available for this date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                    Route Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                    Driver Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">
                    Available
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">
                    Not Available
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">
                    No Response
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                    Response Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {availabilitySummary.map((route) => (
                  <tr key={route.routeId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {route.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={route.driverStatus}>
                        {route.driverLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-green-700 font-semibold">
                      {route.availableCount}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-red-700 font-semibold">
                      {route.notAvailableCount}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">
                      {route.noResponseCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${route.responseRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">
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
      </section>

      {/* Two Column Layout: Fee Collection & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Fee Collection */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Fee Collection This Month
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {format(today, "MMMM yyyy")}
              </p>
            </div>
            <Link
              href={{ pathname: "/dashboard/fees", query: { tab: "pending" } }}
              className="inline-flex rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
            >
              Review Now
            </Link>
          </div>

          {/* Fee Summary Cards */}
          {isFeeCardLoading ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <SkeletonLoader variant="card" className="rounded-lg p-4" />
              <SkeletonLoader variant="card" className="rounded-lg p-4" />
              <SkeletonLoader variant="card" className="rounded-lg p-4" />
            </div>
          ) : (
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Total Collected
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatPKR(feeTotalCollected)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Pending Reviews
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-700">
                  {feePendingCount}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                  Verified
                </p>
                <p className="mt-2 text-2xl font-bold text-green-700">
                  {feeVerifiedCount}
                </p>
              </div>
            </div>
          )}

          {/* Fee Chart */}
          {isFeeCardLoading ? (
            <div className="h-48 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="animate-pulse h-full">
                <div className="flex h-full items-end gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="flex-1 space-y-2">
                      <div
                        className="w-full rounded-t bg-slate-200"
                        style={{ height: `${25 + ((index * 13) % 45)}%` }}
                      />
                      <div className="mx-auto h-2 w-8 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={feeChartData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value: number) => formatPKR(value)} />
                  <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <ActivityFeed
          title="Recent Activity"
          viewAllHref={{
            pathname: "/dashboard/fees",
            query: { tab: "pending" },
          }}
          items={recentPayments.map((payment) => ({
            id: payment.id,
            title: `${payment.studentName} submitted ${payment.month} fee via ${payment.paymentMethod}`,
            status: payment.paymentStatus,
            date: payment.submittedAt,
          }))}
          emptyText="No recent activity found."
        />
      </div>

      {/* Quick Actions Row */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={{ pathname: "/dashboard/routes", query: { create: "1" } }}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
        >
          <span aria-hidden>+</span>
          <span>Create Route</span>
        </Link>
        <Link
          href={{ pathname: "/dashboard/rides", query: { create: "1" } }}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
        >
          <span aria-hidden>+</span>
          <span>Create Ride</span>
        </Link>
        <Link
          href={{ pathname: "/dashboard/drivers", query: { tab: "pending" } }}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
        >
          <span aria-hidden>+</span>
          <span>Approve Drivers</span>
          {pendingDriversCount > 0 && (
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {pendingDriversCount}
            </span>
          )}
        </Link>
        <Link
          href={{ pathname: "/dashboard/availability" }}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
        >
          <span aria-hidden>+</span>
          <span>View Availability</span>
        </Link>
      </section>
    </div>
  );
}
