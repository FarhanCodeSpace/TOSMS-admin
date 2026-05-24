"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { addDays, format, formatDistanceToNow, isSameDay } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Route as RouteIcon,
  Printer,
  RefreshCw,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { Availability, Route, User } from "@/types";
import RouteAvailabilityCard from "@/components/availability/RouteAvailabilityCard";
import { StudentAvailabilityRowData } from "@/components/availability/StudentAvailabilityRow";
import PrintableAvailabilityReport from "@/components/availability/PrintableAvailabilityReport";

type AvailabilityRecord = Omit<Availability, "isAvailable" | "markedAt"> & {
  isAvailable?: boolean;
  markedAt?: Timestamp | null;
  reminderSent?: boolean;
};

type DriverStatus = "available" | "not_available" | "no_response";

type RouteReport = {
  route: Route;
  driver: {
    name: string;
    phone?: string;
    profileImageUrl?: string;
    status: DriverStatus;
    note?: string;
    vehicleAvailable?: boolean;
  };
  students: StudentAvailabilityRowData[];
  counts: {
    available: number;
    notAvailable: number;
    noResponse: number;
  };
  noResponseStudentIds: string[];
  lastUpdated?: Date | null;
};

const STATUS_RANK: Record<StudentAvailabilityRowData["status"], number> = {
  available: 0,
  no_response: 1,
  not_available: 2,
};

function getStatusFromRecord(
  record: AvailabilityRecord | undefined,
): StudentAvailabilityRowData["status"] {
  if (record?.isAvailable === true) return "available";
  if (record?.isAvailable === false) return "not_available";
  return "no_response";
}

function formatDateHeaderLabel(selectedDate: Date): string {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  if (isSameDay(selectedDate, tomorrow)) {
    return `Tomorrow — ${format(selectedDate, "EEEE, MMMM d, yyyy")}`;
  }

  if (isSameDay(selectedDate, today)) {
    return `Today — ${format(selectedDate, "EEEE, MMMM d, yyyy")}`;
  }

  return format(selectedDate, "EEEE, MMMM d, yyyy");
}

function isLogoutPermissionError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  return code === "permission-denied" && !auth.currentUser;
}

export default function AvailabilityPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allAvailability, setAllAvailability] = useState<AvailabilityRecord[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedByRoute, setExpandedByRoute] = useState<
    Record<string, boolean>
  >({});
  const [sortAscByRoute, setSortAscByRoute] = useState<Record<string, boolean>>(
    {},
  );
  const [sendingReminderRouteId, setSendingReminderRouteId] = useState<
    string | null
  >(null);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<Date>(new Date());

  const selectedDateKey = useMemo(
    () => format(selectedDate, "yyyy-MM-dd"),
    [selectedDate],
  );

  const dateHeaderLabel = useMemo(
    () => formatDateHeaderLabel(selectedDate),
    [selectedDate],
  );

  const loadSnapshotDataOnce = useCallback(async (dateKey: string) => {
    try {
      const [routesSnap, usersSnap, availabilitySnap] = await Promise.all([
        getDocs(
          query(
            collection(db, COLLECTIONS.ROUTES),
            where("isActive", "==", true),
          ),
        ),
        getDocs(collection(db, COLLECTIONS.USERS)),
        getDocs(
          query(
            collection(db, COLLECTIONS.AVAILABILITY),
            where("date", "==", dateKey),
          ),
        ),
      ]);

      setRoutes(
        routesSnap.docs.map((routeDoc) => ({
          ...(routeDoc.data() as Route),
          routeId: routeDoc.id,
        })),
      );

      setUsers(
        usersSnap.docs
          .map((userDoc) => ({
            ...(userDoc.data() as User),
            uid: userDoc.id,
          }))
          .filter((user) => user.role === "student" || user.role === "driver"),
      );

      const availabilityData = availabilitySnap.docs.map((availabilityDoc) => ({
        ...(availabilityDoc.data() as AvailabilityRecord),
        availabilityId:
          (availabilityDoc.data() as Partial<AvailabilityRecord>)
            .availabilityId || availabilityDoc.id,
      }));

      setAllAvailability(availabilityData);
      setDataLoading(false);

      setLastUpdated(new Date());
    } catch (error) {
      if (isLogoutPermissionError(error)) {
        return;
      }

      console.error("Error loading availability report:", error);
      toast.error("Failed to load availability report");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!liveUpdates) {
      setIsLoading(true);
      void loadSnapshotDataOnce(selectedDateKey);
      return;
    }

    setIsLoading(true);
    setDataLoading(true);

    let hasRoutes = false;
    let hasUsers = false;
    let hasAvailability = false;

    const markLoaded = () => {
      if (hasRoutes && hasUsers && hasAvailability) {
        setIsLoading(false);
      }
    };

    const unsubscribeRoutes = onSnapshot(
      query(collection(db, COLLECTIONS.ROUTES), where("isActive", "==", true)),
      (snapshot) => {
        hasRoutes = true;
        setRoutes(
          snapshot.docs.map((routeDoc) => ({
            ...(routeDoc.data() as Route),
            routeId: routeDoc.id,
          })),
        );
        markLoaded();
      },
      (error) => {
        if (isLogoutPermissionError(error)) return;
        console.error("Error subscribing routes:", error);
        toast.error("Live route updates failed");
      },
    );

    const unsubscribeUsers = onSnapshot(
      collection(db, COLLECTIONS.USERS),
      (snapshot) => {
        hasUsers = true;
        setUsers(
          snapshot.docs
            .map((userDoc) => ({
              ...(userDoc.data() as User),
              uid: userDoc.id,
            }))
            .filter(
              (user) => user.role === "student" || user.role === "driver",
            ),
        );
        markLoaded();
      },
      (error) => {
        if (isLogoutPermissionError(error)) return;
        console.error("Error subscribing users:", error);
        toast.error("Live user updates failed");
      },
    );

    // Single Listener for all availability on the selected date
    const unsubscribeAvailability = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("date", "==", selectedDateKey),
      ),
      (snapshot) => {
        hasAvailability = true;
        const allData = snapshot.docs.map((doc) => ({
          ...(doc.data() as AvailabilityRecord),
          availabilityId: doc.id,
        }));

        setAllAvailability(allData);
        setDataLoading(false);
        setLastUpdated(new Date());
        markLoaded();
      },
      (error) => {
        if (isLogoutPermissionError(error)) return;
        console.error("Error subscribing availability:", error);
        toast.error("Live availability updates failed");
        setDataLoading(false);
        markLoaded();
      },
    );

    return () => {
      unsubscribeRoutes();
      unsubscribeUsers();
      unsubscribeAvailability();
    };
  }, [liveUpdates, selectedDateKey, loadSnapshotDataOnce]);

  const routeReports = useMemo<RouteReport[]>(() => {
    const usersById = new Map(users.map((user) => [user.uid, user]));
    const availabilityByCompositeKey = new Map<string, AvailabilityRecord>();

    allAvailability.forEach((record) => {
      // Primary key: user_route_role
      availabilityByCompositeKey.set(
        `${record.userId}_${record.routeId}_${record.role}`,
        record,
      );
      // Fallback key: user_role (in case routeId is missing or mismatch in record)
      if (!record.routeId || record.routeId === "") {
        availabilityByCompositeKey.set(
          `${record.userId}_${record.role}`,
          record,
        );
      }
    });

    return routes.map((route) => {
      const sortAscending = sortAscByRoute[route.routeId] ?? true;

      const driverUser = route.assignedDriverId
        ? usersById.get(route.assignedDriverId)
        : undefined;

      // Try specific key first, then fallback
      const driverRecord = route.assignedDriverId
        ? availabilityByCompositeKey.get(
            `${route.assignedDriverId}_${route.routeId}_driver`,
          ) ||
          availabilityByCompositeKey.get(`${route.assignedDriverId}_driver`)
        : undefined;

      const driverStatus = route.assignedDriverId
        ? (getStatusFromRecord(driverRecord) as DriverStatus)
        : "no_response";

      const students = (route.studentIds || [])
        .map((studentId) => {
          const studentUser = usersById.get(studentId);
          // Try specific key first, then fallback
          const availabilityRecord =
            availabilityByCompositeKey.get(
              `${studentId}_${route.routeId}_student`,
            ) || availabilityByCompositeKey.get(`${studentId}_student`);

          return {
            userId: studentId,
            name: studentUser?.fullName || "Unknown Student",
            pickupStop: studentUser?.pickupStop,
            profileImageUrl: studentUser?.profileImageUrl,
            status: getStatusFromRecord(availabilityRecord),
            note: availabilityRecord?.note,
            markedAt: availabilityRecord?.markedAt,
            reminderSent: availabilityRecord?.reminderSent,
          } as StudentAvailabilityRowData;
        })
        .sort((a, b) => {
          const rankDiff = sortAscending
            ? STATUS_RANK[a.status] - STATUS_RANK[b.status]
            : STATUS_RANK[b.status] - STATUS_RANK[a.status];
          if (rankDiff !== 0) return rankDiff;
          return a.name.localeCompare(b.name);
        });

      const availableCount = students.filter(
        (student) => student.status === "available",
      ).length;
      const notAvailableCount = students.filter(
        (student) => student.status === "not_available",
      ).length;
      const noResponseCount = students.filter(
        (student) => student.status === "no_response",
      ).length;

      // Find last updated for this route
      const relevantRecords = [
        driverRecord,
        ...(route.studentIds || []).map(
          (sid) =>
            availabilityByCompositeKey.get(`${sid}_${route.routeId}_student`) ||
            availabilityByCompositeKey.get(`${sid}_student`),
        ),
      ].filter(Boolean) as AvailabilityRecord[];

      let routeLastUpdated: Date | null = null;
      relevantRecords.forEach((r) => {
        if (r.markedAt) {
          const d = r.markedAt.toDate();
          if (!routeLastUpdated || d > routeLastUpdated) {
            routeLastUpdated = d;
          }
        }
      });

      return {
        route,
        driver: {
          name:
            driverUser?.fullName ||
            route.assignedDriverName ||
            "Unassigned Driver",
          phone: driverUser?.phone,
          profileImageUrl: driverUser?.profileImageUrl,
          status: driverStatus,
          note: driverRecord?.note,
          vehicleAvailable: driverRecord?.vehicleAvailable,
        },
        students,
        counts: {
          available: availableCount,
          notAvailable: notAvailableCount,
          noResponse: noResponseCount,
        },
        noResponseStudentIds: students
          .filter((student) => student.status === "no_response")
          .map((student) => student.userId),
        lastUpdated: routeLastUpdated,
      };
    });
  }, [allAvailability, routes, sortAscByRoute, users]);

  const summary = useMemo(() => {
    let available = 0;
    let notAvailable = 0;
    let noResponse = 0;
    let routesReady = 0;
    let routesNeedAttention = 0;

    routeReports.forEach((report) => {
      if (report.driver.status === "available") {
        available += 1;
        routesReady += 1;
      } else if (report.driver.status === "not_available") {
        notAvailable += 1;
        routesNeedAttention += 1;
      } else {
        noResponse += 1;
        routesNeedAttention += 1;
      }

      available += report.counts.available;
      notAvailable += report.counts.notAvailable;
      noResponse += report.counts.noResponse;
    });

    const totalPeople = available + notAvailable + noResponse;
    const noResponsePercent =
      totalPeople > 0 ? Math.round((noResponse / totalPeople) * 100) : 0;

    return {
      available,
      notAvailable,
      noResponse,
      routesReady,
      totalRoutes: routeReports.length,
      routesNeedAttention,
      noResponsePercent,
      highNoResponse: noResponsePercent >= 35,
    };
  }, [routeReports]);

  const isTomorrowSelected = useMemo(
    () => isSameDay(selectedDate, addDays(new Date(), 1)),
    [selectedDate],
  );

  const deadlinePassed = useMemo(() => {
    if (!isTomorrowSelected) return false;
    return new Date().getHours() >= 22;
  }, [isTomorrowSelected]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadSnapshotDataOnce(selectedDateKey);
  };

  const toggleRouteExpanded = (routeId: string) => {
    setExpandedByRoute((previous) => ({
      ...previous,
      [routeId]: !(previous[routeId] ?? true),
    }));
  };

  const toggleRouteSort = (routeId: string) => {
    setSortAscByRoute((previous) => ({
      ...previous,
      [routeId]: !(previous[routeId] ?? true),
    }));
  };

  const exportRouteCsv = (report: RouteReport) => {
    const header = [
      "Route",
      "Departure Time",
      "Person Type",
      "Name",
      "Phone",
      "Pickup Stop",
      "Status",
      "Note",
    ];

    const driverRow = [
      report.route.routeName,
      report.route.departureTime,
      "Driver",
      report.driver.name,
      report.driver.phone || "",
      "-",
      report.driver.status,
      report.driver.note || "",
    ];

    const studentRows = report.students.map((student) => [
      report.route.routeName,
      report.route.departureTime,
      "Student",
      student.name,
      "",
      student.pickupStop || "",
      student.status,
      student.note || "",
    ]);

    const csv = [
      header.join(","),
      [driverRow, ...studentRows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n"),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.route.routeName.replace(/\s+/g, "-").toLowerCase()}-${selectedDateKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${report.route.routeName} CSV`);
  };

  const sendReminderToNonRespondents = async (report: RouteReport) => {
    if (!report.noResponseStudentIds.length) {
      toast("All students on this route already responded");
      return;
    }

    try {
      setSendingReminderRouteId(report.route.routeId);

      const existingNoResponseRecords = allAvailability.filter(
        (record) =>
          record.routeId === report.route.routeId &&
          record.date === selectedDateKey &&
          record.role === "student" &&
          report.noResponseStudentIds.includes(record.userId),
      );

      if (!existingNoResponseRecords.length) {
        toast("No existing availability records to update for reminders");
        return;
      }

      const batch = writeBatch(db);

      existingNoResponseRecords.forEach((record) => {
        const availabilityId =
          record.availabilityId || `${record.userId}_${record.date}`;

        batch.update(doc(db, COLLECTIONS.AVAILABILITY, availabilityId), {
          reminderSent: true,
          reminderSentAt: serverTimestamp(),
        });
      });

      await batch.commit();

      const skippedCount =
        report.noResponseStudentIds.length - existingNoResponseRecords.length;
      if (skippedCount > 0) {
        toast.success(
          `Reminder updated for ${existingNoResponseRecords.length} students (${skippedCount} had no record)`,
        );
      } else {
        toast.success(
          `Reminder sent to ${existingNoResponseRecords.length} non-respondent students`,
        );
      }

      if (!liveUpdates) {
        setIsRefreshing(true);
        await loadSnapshotDataOnce(selectedDateKey);
      }
    } catch (error: any) {
      console.error("Error sending reminders:", error);

      if (error?.code === "permission-denied") {
        toast.error(
          "Permission denied. Update Firestore rules to allow admin reminder writes on availability records.",
        );
      } else if (error?.message?.includes("insufficient permissions")) {
        toast.error("Insufficient Firestore permissions for reminder updates.");
      } else {
        toast.error("Failed to send reminders");
      }
    } finally {
      setSendingReminderRouteId(null);
    }
  };

  const handlePrintReport = () => {
    setExpandedByRoute((previous) => {
      const nextState = { ...previous };
      routeReports.forEach((report) => {
        nextState[report.route.routeId] = true;
      });
      return nextState;
    });

    setReportGeneratedAt(new Date());

    window.setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Route Availability
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Daily readiness overview for drivers and students.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  setSelectedDate((previous) => addDays(previous, -1))
                }
                className="rounded-lg border border-slate-300 p-2 text-slate-700 transition hover:bg-slate-50"
                aria-label="Previous date"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
                <CalendarDays size={16} />
                {dateHeaderLabel}
              </div>
              <button
                onClick={() =>
                  setSelectedDate((previous) => addDays(previous, 1))
                }
                className="rounded-lg border border-slate-300 p-2 text-slate-700 transition hover:bg-slate-50"
                aria-label="Next date"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Today
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                <span>Live</span>
                <button
                  role="switch"
                  aria-checked={liveUpdates}
                  onClick={() => setLiveUpdates((previous) => !previous)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    liveUpdates ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      liveUpdates ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {!liveUpdates ? (
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    size={16}
                    className={isRefreshing ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              ) : null}

              <button
                onClick={handlePrintReport}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Printer size={16} />
                Print Report
              </button>
            </div>

            <p className="text-right text-xs text-slate-500">
              Updated{" "}
              {lastUpdated
                ? formatDistanceToNow(lastUpdated, { addSuffix: true })
                : "just now"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 print:hidden">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
          <CircleCheck size={18} className="shrink-0" />
          <p className="text-sm font-semibold">
            {summary.routesReady} of {summary.totalRoutes} routes ready
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <ClipboardList size={18} className="shrink-0" />
          <p className="text-sm font-semibold">
            {summary.noResponse} pending responses
          </p>
        </div>
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
            summary.routesNeedAttention > 0
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          <AlertTriangle size={18} className="shrink-0" />
          {summary.routesNeedAttention > 0
            ? `${summary.routesNeedAttention} routes require action`
            : "No route-level alerts"}
        </div>
      </div>

      {deadlinePassed ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 print:hidden">
          Submission window for tomorrow has closed. This report now reflects
          final responses.
        </div>
      ) : null}

      <PrintableAvailabilityReport
        selectedDate={selectedDate}
        reportGeneratedAt={reportGeneratedAt}
        routeReports={routeReports}
        summary={summary}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 print:hidden">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Available</p>
          <p className="mt-2 text-3xl font-bold text-emerald-800">
            {summary.available}
          </p>
          <p className="mt-1 text-xs text-emerald-700">Students and drivers</p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-rose-700">Not Available</p>
          <p className="mt-2 text-3xl font-bold text-rose-800">
            {summary.notAvailable}
          </p>
          <p className="mt-1 text-xs text-rose-700">Students and drivers</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">No Response</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {summary.noResponse}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {summary.noResponsePercent}% of all records
          </p>
          {summary.highNoResponse ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
              <AlertTriangle size={12} />
              Elevated no-response rate
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Route Readiness</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">
            {summary.routesReady}/{summary.totalRoutes}
          </p>
          {summary.routesNeedAttention > 0 ? (
            <p className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
              {summary.routesNeedAttention} routes need attention
            </p>
          ) : (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
              <RouteIcon size={12} />
              All routes ready
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
          <RefreshCw
            className="mx-auto mb-3 animate-spin text-slate-400"
            size={20}
          />
          Loading availability data...
        </div>
      ) : routeReports.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
          <XCircle className="mx-auto mb-3 text-slate-400" size={20} />
          No active routes found for the selected date.
        </div>
      ) : (
        <div className="space-y-4">
          {routeReports.map((report) => {
            const isExpanded = expandedByRoute[report.route.routeId] ?? true;
            const sortAscending = sortAscByRoute[report.route.routeId] ?? true;

            return (
              <RouteAvailabilityCard
                key={report.route.routeId}
                routeName={report.route.routeName}
                departureTime={report.route.departureTime}
                totalStudents={(report.route.studentIds || []).length}
                expanded={isExpanded}
                onToggleExpanded={() =>
                  toggleRouteExpanded(report.route.routeId)
                }
                driver={report.driver}
                students={report.students}
                studentCounts={report.counts}
                sortAscending={sortAscending}
                onToggleSort={() => toggleRouteSort(report.route.routeId)}
                onExportRouteCsv={() => exportRouteCsv(report)}
                onSendReminder={() => sendReminderToNonRespondents(report)}
                reminderDisabled={
                  sendingReminderRouteId === report.route.routeId ||
                  report.noResponseStudentIds.length === 0
                }
                driverLoading={dataLoading}
                studentLoading={dataLoading}
                lastUpdated={report.lastUpdated}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
