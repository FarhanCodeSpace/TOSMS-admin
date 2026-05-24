"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { AlertTriangle, Plus, Rows4 } from "lucide-react";
import toast from "react-hot-toast";

import BulkCreateModal from "@/components/rides/BulkCreateModal";
import CreateRideModal from "@/components/rides/CreateRideModal";
import RideCard from "@/components/rides/RideCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Availability, Ride, Route, User } from "@/types";
import {
  formatDateDisplay,
  getDateString,
  getTodayString,
} from "@/utils/dateHelpers";
import {
  formatTimeTo12Hour,
  formatTimestamp,
  getInitials,
} from "@/utils/formatters";

type RideWithMeta = Ride & {
  activeAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  scheduledAt?: Timestamp;
};

type AvailableStudentEntry = {
  userId: string;
  userName: string;
  pickupStop?: string;
};

function RideStatusBadge({ status }: { status: Ride["status"] }) {
  if (status === "scheduled") {
    return (
      <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
        Scheduled
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
        Completed
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
      Cancelled
    </span>
  );
}

type RideDetailModalProps = {
  open: boolean;
  ride: RideWithMeta | null;
  studentsById: Map<string, User>;
  onClose: () => void;
};

function RideDetailModal({
  open,
  ride,
  studentsById,
  onClose,
}: RideDetailModalProps) {
  const [availableStudents, setAvailableStudents] = useState<
    AvailableStudentEntry[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !ride) return;

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("date", "==", ride.date),
      ),
      (snapshot) => {
        const students = snapshot.docs
          .map((availabilityDoc) => availabilityDoc.data() as Availability)
          .filter(
            (data) =>
              data.routeId === ride.routeId &&
              data.role === "student" &&
              data.isAvailable === true,
          )
          .map((data) => {
            const studentProfile = studentsById.get(data.userId);
            return {
              userId: data.userId,
              userName: data.userName,
              pickupStop: studentProfile?.pickupStop,
            };
          });

        setAvailableStudents(students);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error loading ride detail availability:", error);
        toast.error("Failed to load ride details");
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [open, ride?.rideId, studentsById]);

  if (!ride) return null;

  return (
    <Modal open={open} onClose={onClose} title="Ride Details">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-lg font-bold text-slate-900">{ride.routeName}</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
            <p>
              Driver:{" "}
              <span className="font-semibold text-slate-900">
                {ride.driverName}
              </span>
            </p>
            <p>
              Date:{" "}
              <span className="font-semibold text-slate-900">
                {formatDateDisplay(ride.date)}
              </span>
            </p>
            <p>
              Departure:{" "}
              <span className="font-semibold text-slate-900">
                {formatTimeTo12Hour(ride.departureTime)}
              </span>
            </p>
            <p>
              Status: <RideStatusBadge status={ride.status} />
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Students Available Today
            </h4>
            <span className="text-xs font-semibold text-slate-500">
              {availableStudents.length} students
            </span>
          </div>

          {isLoading ? (
            <div className="mt-3 space-y-2">
              <SkeletonLoader rows={1} className="h-4 w-1/3" />
              <SkeletonLoader rows={1} className="h-4 w-full" />
              <SkeletonLoader rows={1} className="h-4 w-2/3" />
            </div>
          ) : availableStudents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No available students for this ride date.
            </p>
          ) : (
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {availableStudents.map((student) => (
                <div
                  key={student.userId}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-slate-900">
                    {student.userName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Pickup stop: {student.pickupStop || "Not set"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-900">Boarded Count</h4>
          <p className="mt-1 text-sm text-slate-700">
            {ride.boardedCount || 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-900">Timeline</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>Created</span>
              <span>{formatTimestamp(ride.createdAt)}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>Scheduled</span>
              <span>{formatTimestamp(ride.scheduledAt || ride.createdAt)}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>Active</span>
              <span>{formatTimestamp(ride.activeAt)}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>Completed</span>
              <span>{formatTimestamp(ride.completedAt)}</span>
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

export default function RidesPage() {
  const searchParams = useSearchParams();
  const todayString = getTodayString();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [studentsById, setStudentsById] = useState<Map<string, User>>(
    new Map(),
  );

  const [todayRides, setTodayRides] = useState<RideWithMeta[]>([]);
  const [isTodayRidesLoading, setIsTodayRidesLoading] = useState(true);
  const [todayAvailabilityCountByRoute, setTodayAvailabilityCountByRoute] =
    useState<Record<string, number>>({});

  const [allRides, setAllRides] = useState<RideWithMeta[]>([]);
  const [isAllRidesLoading, setIsAllRidesLoading] = useState(true);
  const [availabilityCountByRouteDate, setAvailabilityCountByRouteDate] =
    useState<Record<string, number>>({});

  const [rangeStart, setRangeStart] = useState(getDateString(-7));
  const [rangeEnd, setRangeEnd] = useState(getDateString(7));
  const [routeFilter, setRouteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Ride["status"]>(
    "all",
  );

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [detailModalRide, setDetailModalRide] = useState<RideWithMeta | null>(
    null,
  );
  const [cancelRideTarget, setCancelRideTarget] = useState<RideWithMeta | null>(
    null,
  );

  const [isCancelling, setIsCancelling] = useState(false);
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [isCreatingTodayAll, setIsCreatingTodayAll] = useState(false);

  useEffect(() => {
    const shouldOpenCreate =
      searchParams.get("create") === "1" ||
      searchParams.get("create") === "true";
    if (shouldOpenCreate) {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.ROUTES),
      (snapshot) => {
        const routesList = snapshot.docs.map((routeDoc) => ({
          ...(routeDoc.data() as Route),
          routeId: routeDoc.id,
        }));
        setRoutes(routesList);
      },
      (error) => {
        console.error("Error fetching routes:", error);
        toast.error("Failed to load routes");
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "student")),
      (snapshot) => {
        const map = new Map<string, User>();
        snapshot.docs.forEach((userDoc) => {
          map.set(userDoc.id, {
            ...(userDoc.data() as User),
            uid: userDoc.id,
          });
        });
        setStudentsById(map);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsTodayRidesLoading(true);
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.RIDES),
        where("date", "==", todayString),
      ),
      (snapshot) => {
        const rides = snapshot.docs.map((rideDoc) => ({
          ...(rideDoc.data() as RideWithMeta),
          rideId: rideDoc.id,
        }));
        setTodayRides(rides);
        setIsTodayRidesLoading(false);
      },
      (error) => {
        console.error("Error fetching today's rides:", error);
        toast.error("Failed to load today's rides");
        setIsTodayRidesLoading(false);
      },
    );

    return () => unsubscribe();
  }, [todayString]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("date", "==", todayString),
      ),
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach((availabilityDoc) => {
          const data = availabilityDoc.data() as Availability;
          if (data.role !== "student" || data.isAvailable !== true) return;
          counts[data.routeId] = (counts[data.routeId] || 0) + 1;
        });
        setTodayAvailabilityCountByRoute(counts);
      },
    );

    return () => unsubscribe();
  }, [todayString]);

  useEffect(() => {
    setIsAllRidesLoading(true);
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.RIDES),
        where("date", ">=", rangeStart),
        where("date", "<=", rangeEnd),
      ),
      (snapshot) => {
        const rides = snapshot.docs.map((rideDoc) => ({
          ...(rideDoc.data() as RideWithMeta),
          rideId: rideDoc.id,
        }));
        setAllRides(rides);
        setIsAllRidesLoading(false);
      },
      (error) => {
        console.error("Error fetching rides:", error);
        toast.error("Failed to load rides table");
        setIsAllRidesLoading(false);
      },
    );

    return () => unsubscribe();
  }, [rangeEnd, rangeStart]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("date", ">=", rangeStart),
        where("date", "<=", rangeEnd),
      ),
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach((availabilityDoc) => {
          const data = availabilityDoc.data() as Availability;
          if (data.role !== "student" || data.isAvailable !== true) return;
          const key = `${data.routeId}__${data.date}`;
          counts[key] = (counts[key] || 0) + 1;
        });
        setAvailabilityCountByRouteDate(counts);
      },
    );

    return () => unsubscribe();
  }, [rangeEnd, rangeStart]);

  const filteredAllRides = useMemo(() => {
    return allRides
      .filter((ride) => {
        if (routeFilter !== "all" && ride.routeId !== routeFilter) return false;
        if (statusFilter !== "all" && ride.status !== statusFilter)
          return false;
        return true;
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return a.departureTime.localeCompare(b.departureTime);
      });
  }, [allRides, routeFilter, statusFilter]);

  const handleMarkCompleted = async (ride: RideWithMeta) => {
    setIsMarkingCompleted(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.RIDES, ride.rideId), {
        status: "completed",
        completedAt: serverTimestamp(),
      });
      toast.success("Ride marked as completed");
    } catch (error) {
      console.error("Error marking ride completed:", error);
      toast.error("Failed to update ride");
    } finally {
      setIsMarkingCompleted(false);
    }
  };

  const handleCancelRideConfirm = async () => {
    if (!cancelRideTarget) return;

    setIsCancelling(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.RIDES, cancelRideTarget.rideId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      });

      toast.success("Ride cancelled");
      setCancelRideTarget(null);
    } catch (error) {
      console.error("Error cancelling ride:", error);
      toast.error("Failed to cancel ride");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCreateAllTodayRides = useCallback(async () => {
    setIsCreatingTodayAll(true);
    try {
      const [activeRoutesSnap, existingTodaySnap] = await Promise.all([
        getDocs(
          query(
            collection(db, COLLECTIONS.ROUTES),
            where("isActive", "==", true),
          ),
        ),
        getDocs(
          query(
            collection(db, COLLECTIONS.RIDES),
            where("date", "==", todayString),
          ),
        ),
      ]);

      const existingRouteIds = new Set(
        existingTodaySnap.docs.map(
          (rideDoc) => (rideDoc.data() as Ride).routeId,
        ),
      );

      const activeRoutes = activeRoutesSnap.docs.map((routeDoc) => ({
        ...(routeDoc.data() as Route),
        routeId: routeDoc.id,
      }));

      const routesToCreate = activeRoutes.filter(
        (route) => !existingRouteIds.has(route.routeId),
      );

      if (routesToCreate.length === 0) {
        toast("All active routes already have today's rides");
        return;
      }

      const batch = writeBatch(db);
      routesToCreate.forEach((route) => {
        const rideRef = doc(collection(db, COLLECTIONS.RIDES));
        batch.set(rideRef, {
          rideId: rideRef.id,
          routeId: route.routeId,
          routeName: route.routeName || "Unnamed Route",
          assignedDriverId: route.assignedDriverId || "",
          driverName: route.assignedDriverName || "Unassigned Driver",
          date: todayString,
          departureTime: route.departureTime || "08:00",
          status: "scheduled",
          boardedCount: 0,
          createdAt: serverTimestamp(),
          scheduledAt: serverTimestamp(),
        });
      });

      await batch.commit();
      toast.success(`Created ${routesToCreate.length} rides for today`);
    } catch (error) {
      console.error("Error creating today's rides:", error);
      toast.error("Failed to create today's rides");
    } finally {
      setIsCreatingTodayAll(false);
    }
  }, [todayString]);

  return (
    <section className="space-y-7">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text)]">
              Rides Management
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Create daily rides and monitor route execution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Create Ride
            </button>
            <button
              type="button"
              onClick={() => setBulkModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:opacity-90"
            >
              <Rows4 className="h-4 w-4" />
              Bulk Create Rides
            </button>
          </div>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text)]">
            {"Today's Rides"}
          </h2>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            {formatDateDisplay(todayString)}
          </p>
        </div>

        {isTodayRidesLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SkeletonLoader variant="card" className="h-56" />
            <SkeletonLoader variant="card" className="h-56" />
          </div>
        ) : todayRides.length === 0 ? (
          <div className="rounded-xl border border-orange-300 bg-orange-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-orange-800">
                No rides created for today. Create rides for all routes?
              </p>
              <button
                type="button"
                disabled={isCreatingTodayAll}
                onClick={handleCreateAllTodayRides}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {isCreatingTodayAll
                  ? "Creating..."
                  : "Create All Today's Rides"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {todayRides
              .slice()
              .sort((a, b) => a.departureTime.localeCompare(b.departureTime))
              .map((ride) => (
                <RideCard
                  key={ride.rideId}
                  ride={ride}
                  availableStudentsCount={
                    todayAvailabilityCountByRoute[ride.routeId] || 0
                  }
                  onViewDetails={() => setDetailModalRide(ride)}
                  onCancelRide={() => setCancelRideTarget(ride)}
                  onMarkCompleted={() => void handleMarkCompleted(ride)}
                />
              ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text)]">All Rides</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 md:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Start Date
            <input
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-500"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            End Date
            <input
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-500"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Route Filter
            <select
              value={routeFilter}
              onChange={(event) => setRouteFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">All Routes</option>
              {routes.map((route) => (
                <option key={route.routeId} value={route.routeId}>
                  {route.routeName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status Filter
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | Ride["status"])
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>

        {isAllRidesLoading ? (
          <SkeletonLoader variant="table" rows={8} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-[var(--surface-secondary)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Route Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Departure
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Available Students
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Boarded Count
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                {filteredAllRides.map((ride) => {
                  const availabilityKey = `${ride.routeId}__${ride.date}`;
                  const availableCount =
                    availabilityCountByRouteDate[availabilityKey] || 0;

                  return (
                    <tr
                      key={ride.rideId}
                      onClick={() => setDetailModalRide(ride)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {ride.routeName}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-xs font-semibold text-white">
                            {getInitials(ride.driverName || "Driver")}
                          </span>
                          {ride.driverName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatDateDisplay(ride.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatTimeTo12Hour(ride.departureTime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <RideStatusBadge status={ride.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {availableCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {ride.status === "active" || ride.status === "completed"
                          ? ride.boardedCount || 0
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div
                          className="flex flex-wrap gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setDetailModalRide(ride)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            View Details
                          </button>
                          {ride.status === "scheduled" ? (
                            <button
                              type="button"
                              onClick={() => setCancelRideTarget(ride)}
                              className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                            >
                              Cancel Ride
                            </button>
                          ) : null}
                          {ride.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => void handleMarkCompleted(ride)}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            >
                              Mark Completed
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredAllRides.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No rides found for selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CreateRideModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => undefined}
      />

      <BulkCreateModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onCompleted={() => undefined}
      />

      <RideDetailModal
        open={!!detailModalRide}
        ride={detailModalRide}
        studentsById={studentsById}
        onClose={() => setDetailModalRide(null)}
      />

      <ConfirmDialog
        open={!!cancelRideTarget}
        title="Cancel Ride"
        message="Are you sure you want to cancel this ride?"
        confirmLabel="Cancel Ride"
        onConfirm={() => void handleCancelRideConfirm()}
        onCancel={() => setCancelRideTarget(null)}
        destructive
        isLoading={isCancelling}
      />

      {(isMarkingCompleted || isCreatingTodayAll) && (
        <div className="fixed bottom-5 right-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>
              {isMarkingCompleted
                ? "Updating ride status..."
                : "Creating rides for all routes..."}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
