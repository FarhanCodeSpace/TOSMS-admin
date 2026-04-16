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
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { format, subMonths } from "date-fns";
import { MapPin, Users, GraduationCap, Bus, Sparkles } from "lucide-react";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import StatsCard from "@/components/ui/StatsCard";
import ActivityFeed from "@/components/ui/ActivityFeed";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";

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
  fareAmount: number;
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
  const [recentPayments, setRecentPayments] = useState<FeePaymentRecord[]>([]);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);

  useEffect(() => {
    const activeRoutesQuery = query(
      collection(db, COLLECTIONS.ROUTES),
      where("isActive", "==", true),
    );

    const unsub = onSnapshot(activeRoutesQuery, (snapshot) => {
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
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const activeDriversQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "driver"),
      where("status", "==", "active"),
    );

    const pendingDriversQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "driver"),
      where("status", "==", "pending"),
    );

    const unsubActiveDrivers = onSnapshot(activeDriversQuery, (snapshot) => {
      setActiveDriversCount(snapshot.size);
    });
    const unsubPendingDrivers = onSnapshot(pendingDriversQuery, (snapshot) => {
      setPendingDriversCount(snapshot.size);
    });

    return () => {
      unsubActiveDrivers();
      unsubPendingDrivers();
    };
  }, []);

  useEffect(() => {
    const studentsQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "student"),
    );

    const unsubStudents = onSnapshot(studentsQuery, (snapshot) => {
      let unassigned = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as { routeId?: string };
        if (!data.routeId) {
          unassigned += 1;
        }
      });

      setTotalStudentsCount(snapshot.size);
      setUnassignedStudentsCount(unassigned);
    });

    return () => unsubStudents();
  }, []);

  useEffect(() => {
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

    const unsubActiveRides = onSnapshot(activeRidesQuery, (snapshot) => {
      setActiveRidesCount(snapshot.size);
    });
    const unsubScheduledRides = onSnapshot(scheduledRidesQuery, (snapshot) => {
      setScheduledRidesCount(snapshot.size);
    });

    return () => {
      unsubActiveRides();
      unsubScheduledRides();
    };
  }, []);

  useEffect(() => {
    const availabilityQuery = query(
      collection(db, COLLECTIONS.AVAILABILITY),
      where("date", "==", todayString),
    );

    const unsubAvailability = onSnapshot(availabilityQuery, (snapshot) => {
      setAvailabilityRecords(
        snapshot.docs.map((doc) => doc.data() as AvailabilityRecord),
      );
    });

    return () => unsubAvailability();
  }, []);

  useEffect(() => {
    const feeQuery = query(
      collection(db, COLLECTIONS.FEE_PAYMENTS),
      where("month", "==", currentMonthString),
    );

    const unsubFees = onSnapshot(feeQuery, (snapshot) => {
      let collected = 0;
      let pending = 0;
      let verified = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as {
          fareAmount?: number;
          amount?: number;
          paymentStatus?: string;
        };
        const amount = Number(data.fareAmount ?? data.amount ?? 0);

        switch (data.paymentStatus) {
          case "verified":
            collected += amount;
            verified += 1;
            break;
          case "submitted":
          case "pending":
            pending += 1;
            break;
          default:
            break;
        }
      });

      setFeeTotalCollected(collected);
      setFeePendingCount(pending);
      setFeeVerifiedCount(verified);
    });

    const monthLabels = getMonthLabels(6);
    Promise.all(
      monthLabels.map(async ({ monthKey, monthLabel }) => {
        const snapshot = await getDocs(
          query(
            collection(db, COLLECTIONS.FEE_PAYMENTS),
            where("month", "==", monthKey),
          ),
        );

        return {
          month: monthLabel,
          total: snapshot.docs.reduce((sum, doc) => {
            const data = doc.data() as { fareAmount?: number; amount?: number };
            return sum + Number(data.fareAmount ?? data.amount ?? 0);
          }, 0),
        };
      }),
    ).then(setFeeChartData);

    return () => unsubFees();
  }, []);

  useEffect(() => {
    const recentQuery = query(
      collection(db, COLLECTIONS.FEE_PAYMENTS),
      orderBy("submittedAt", "desc"),
      limit(8),
    );

    const unsubRecent = onSnapshot(recentQuery, (snapshot) => {
      setRecentPayments(
        snapshot.docs.map((doc) => {
          const data = doc.data() as {
            paymentStatus?: string;
            fareAmount?: number;
            month?: string;
            submittedAt?: { toDate?: () => Date } | Date;
            studentName?: string;
            paymentMethod?: string;
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
            fareAmount: Number(data.fareAmount ?? 0),
            month: data.month ?? "Unknown",
            submittedAt,
            studentName: data.studentName ?? "Student",
            paymentMethod: data.paymentMethod ?? "payment",
          };
        }),
      );
    });

    return () => unsubRecent();
  }, []);

  const availabilitySummary = useMemo<AvailabilitySummary[]>(() => {
    return routeRecords.map((route) => {
      const studentIds = route.studentIds ?? [];
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
      const noResponseCount = Math.max(studentIds.length - respondedCount, 0);

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
          studentIds.length > 0
            ? Math.round((respondedCount / studentIds.length) * 100)
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
              href={{ pathname: "/drivers", query: { tab: "pending" } }}
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
              Today&apos;s Availability Overview
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Route availability summary
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Live
          </div>
        </div>

        {availabilitySummary.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-8 w-8" />}
            title="No routes available"
            subtitle="No active route availability has been reported for today."
            actionLabel="Refresh data"
            onAction={() => window.location.reload()}
          />
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
              href={{ pathname: "/fees", query: { tab: "pending" } }}
              className="inline-flex rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
            >
              Review Now
            </Link>
          </div>

          {/* Fee Summary Cards */}
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

          {/* Fee Chart */}
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
        </section>

        {/* Recent Activity */}
        <ActivityFeed
          title="Recent Activity"
          viewAllHref={{ pathname: "/fees", query: { tab: "pending" } }}
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
        <button
          type="button"
          onClick={() => setIsRouteModalOpen(true)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
        >
          + Create Route
        </button>
        <button
          type="button"
          onClick={() => setIsRideModalOpen(true)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
        >
          + Create Ride
        </button>
        <Link
          href={{ pathname: "/drivers", query: { tab: "pending" } }}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
        >
          Approve Drivers
          {pendingDriversCount > 0 && (
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {pendingDriversCount}
            </span>
          )}
        </Link>
        <Link
          href={{ pathname: "/availability" }}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
        >
          View Availability
        </Link>
      </section>

      {/* Modals */}
      <Modal
        open={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        title="Create Route"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Add a new route and manage route details from the dashboard.
          </p>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Route name
              <input
                type="text"
                placeholder="North Campus Loop"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Notes
              <textarea
                rows={3}
                placeholder="Optional route details"
                className="mt-1 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsRouteModalOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Save Route
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={isRideModalOpen}
        onClose={() => setIsRideModalOpen(false)}
        title="Create Ride"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Schedule a ride and keep operations aligned with student transport
            needs.
          </p>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Ride title
              <input
                type="text"
                placeholder="Morning Campus Shuttle"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Ride date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsRideModalOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Save Ride
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
