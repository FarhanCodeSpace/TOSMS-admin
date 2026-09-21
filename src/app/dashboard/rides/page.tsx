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
import { AlertTriangle, Clock3, Plus, Rows4, Download, Zap, Users, Bus } from "lucide-react";
import toast from "react-hot-toast";

import BulkCreateModal from "@/components/rides/BulkCreateModal";
import CreateRideModal from "@/components/rides/CreateRideModal";
import DailyDispatchModal from "@/components/rides/DailyDispatchModal";
import RideCard from "@/components/rides/RideCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Availability, EarlyRideRequest, Ride, Route, User } from "@/types";
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
import { getRouteAssignedDriverIds } from "@/utils/routeAssignments";
import { buildAvailabilityMap, getStudentAvailabilityStats } from "@/utils/availabilityHelpers";
import { RideStatusBadge } from "@/components/ui/RideStatusBadge";

type RideWithMeta = Ride & {
  activeAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  scheduledAt?: Timestamp;
  isEarlyRide?: boolean;
};

type AvailableStudentEntry = {
  userId: string;
  userName: string;
  pickupStop?: string;
};


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
              pickupStop: (studentProfile?.routeStops && studentProfile?.routeStops[ride.routeId]?.pickupStop) || studentProfile?.pickupStop,
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

  const todayDateString = new Date().toISOString().split('T')[0];
  let displayStatus = (ride.date < todayDateString && (ride.status === 'active' || ride.status === 'scheduled')) ? 'cancelled' : ride.status;

  const driverProfile = studentsById.get(ride.assignedDriverId);

  return (
    <Modal open={open} onClose={onClose} title="Ride Details">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-slate-900">{ride.routeName}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <RideStatusBadge status={displayStatus} />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
            <p>
              Driver:{" "}
              <span className="font-semibold text-slate-900">
                {ride.driverName || "Unassigned"}
              </span>
            </p>
            <p>
              Date:{" "}
              <span className="font-semibold text-slate-900">
                {formatDateDisplay(ride.date)}
              </span>
            </p>
            {ride.departureTime || (ride as any).returnTime ? (
              <p>
                {ride.departureTime && !(ride as any).returnTime ? (
                  <>
                    Departure:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatTimeTo12Hour(ride.departureTime)}
                    </span>
                  </>
                ) : !ride.departureTime && (ride as any).returnTime ? (
                  <>
                    Return:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatTimeTo12Hour((ride as any).returnTime)}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold text-slate-900">
                    Dep: {formatTimeTo12Hour(ride.departureTime)} | Ret: {formatTimeTo12Hour((ride as any).returnTime)}
                  </span>
                )}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Available</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {(ride as any).availabilityStats?.available || availableStudents.length || 0}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Unavailable</span>
                  <span className="text-sm font-bold text-red-600">
                    {(ride as any).availabilityStats?.notAvailable || 0}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">No Response</span>
                  <span className="text-sm font-bold text-slate-600">
                    {(ride as any).availabilityStats?.noResponse || 0}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900">
              <Bus className="h-5 w-5 text-blue-500" />
              Vehicle: {driverProfile?.vehicleType || (ride as any).vehicle?.name || (ride as any).vehicleType || "TBD"} - {driverProfile?.vehiclePlate || (ride as any).vehicle?.plateNumber || (ride as any).vehiclePlate || "TBD"}
            </div>
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
  const [allStudentsById, setAllStudentsById] = useState<Record<string, User>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "student")),
      (snapshot) => {
        const nextStudents: Record<string, User> = {};
        snapshot.docs.forEach((doc) => {
          nextStudents[doc.id] = { uid: doc.id, ...doc.data() } as User;
        });
        setAllStudentsById(nextStudents);
      },
      (error) => console.error("Student lookup failed:", error)
    );
    return () => unsubscribe();
  }, []);

  const [todayRides, setTodayRides] = useState<RideWithMeta[]>([]);
  const [isTodayRidesLoading, setIsTodayRidesLoading] = useState(true);
  const [todayAvailabilityRecords, setTodayAvailabilityRecords] = useState<Availability[]>([]);

  const [allRides, setAllRides] = useState<RideWithMeta[]>([]);
  const [isAllRidesLoading, setIsAllRidesLoading] = useState(true);
  const [allAvailabilityRecords, setAllAvailabilityRecords] = useState<Availability[]>([]);

  const [rangeStart, setRangeStart] = useState(getDateString(-7));
  const [rangeEnd, setRangeEnd] = useState(getDateString(7));
  const [routeFilter, setRouteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Ride["status"]>(
    "all",
  );

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchRoutes, setDispatchRoutes] = useState<Route[]>([]);
  const [dispatchDrivers, setDispatchDrivers] = useState<{uid: string, fullName: string}[]>([]);
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
    const cleanupPastRides = async () => {
      try {
        const q = query(
          collection(db, COLLECTIONS.RIDES),
          where("status", "in", ["scheduled", "active"])
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        const batch = writeBatch(db);
        let updateCount = 0;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as Ride;
          if (data.date < todayString) {
            if (data.status === "scheduled" || data.status === "active") {
              batch.update(docSnap.ref, {
                status: "auto_cancelled",
                cancelledAt: serverTimestamp(),
              });
              updateCount++;
            }
          }
        });

        if (updateCount > 0) {
          await batch.commit();
          console.log(`Successfully cleaned up ${updateCount} abandoned past rides.`);
        }
      } catch (error) {
        console.error("Error cleaning up past rides:", error);
      }
    };

    cleanupPastRides();
  }, [todayString]);

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
      collection(db, COLLECTIONS.USERS),
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

    const unsubRegular = onSnapshot(
      query(collection(db, COLLECTIONS.RIDES), where("date", "==", todayString)),
      (snapshot) => {
        const regularRides = snapshot.docs.map((rideDoc) => ({
          ...(rideDoc.data() as RideWithMeta),
          rideId: rideDoc.id,
        })).filter(ride => 
          !(ride.isEarlyRide || (ride as any).source === 'earlyRideSharing' || (ride as any).rideType === 'early' || (ride as any).collectionSource === 'EARLY_RIDE_REQUESTS')
        );
        setTodayRides(regularRides);
        setIsTodayRidesLoading(false);
      },
      (error) => {
        console.error("Error fetching today's rides:", error);
        toast.error("Failed to load today's rides");
        setIsTodayRidesLoading(false);
      }
    );

    return () => unsubRegular();
  }, [todayString]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("date", "==", todayString),
      ),
      (snapshot) => {
        setTodayAvailabilityRecords(
          snapshot.docs.map((doc) => doc.data() as Availability)
        );
      },
    );

    return () => unsubscribe();
  }, [todayString]);

  useEffect(() => {
    setIsAllRidesLoading(true);

    const unsubRegular = onSnapshot(
      query(
        collection(db, COLLECTIONS.RIDES),
        where("date", ">=", rangeStart),
        where("date", "<=", rangeEnd),
      ),
      (snapshot) => {
        const regularRides = snapshot.docs.map((rideDoc) => ({
          ...(rideDoc.data() as RideWithMeta),
          rideId: rideDoc.id,
        })).filter(ride => 
          !(ride.isEarlyRide || (ride as any).source === 'earlyRideSharing' || (ride as any).rideType === 'early' || (ride as any).collectionSource === 'EARLY_RIDE_REQUESTS')
        );
        setAllRides(regularRides);
        setIsAllRidesLoading(false);
      },
      (error) => {
        console.error("Error fetching rides:", error);
        toast.error("Failed to load rides table");
        setIsAllRidesLoading(false);
      }
    );

    return () => unsubRegular();
  }, [rangeEnd, rangeStart]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("date", ">=", rangeStart),
        where("date", "<=", rangeEnd),
      ),
      (snapshot) => {
        setAllAvailabilityRecords(
          snapshot.docs.map((doc) => doc.data() as Availability)
        );
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
        return String(a.departureTime).localeCompare(String(b.departureTime));
      });
  }, [allRides, routeFilter, statusFilter]);

  const todayAvailabilityMap = useMemo(() => buildAvailabilityMap(todayAvailabilityRecords), [todayAvailabilityRecords]);
  const allAvailabilityMap = useMemo(() => buildAvailabilityMap(allAvailabilityRecords, true), [allAvailabilityRecords]);

  const exportToCSV = useCallback(() => {
    if (!filteredAllRides || filteredAllRides.length === 0) {
      toast.error("No rides to export.");
      return;
    }

    const headers = [
      "Date",
      "Route Name",
      "Driver Name",
      "Schedule",
      "Status",
      "Available Students",
      "Unavailable Students",
      "No Response"
    ];

    const rows = filteredAllRides.map(ride => {
      const route = routes.find(r => r.routeId === ride.routeId);
      const studentIds = route?.studentIds || [];
      
      const stats = getStudentAvailabilityStats(studentIds, ride.routeId, allAvailabilityMap, ride.date);
      
      const scheduleParts = [];
      if (ride.departureTime) scheduleParts.push(`Dep: ${formatTimeTo12Hour(ride.departureTime)}`);
      if ((ride as any).returnTime) scheduleParts.push(`Ret: ${formatTimeTo12Hour((ride as any).returnTime)}`);
      const schedule = scheduleParts.join(" | ") || "N/A";

      const todayDateString = new Date().toISOString().split('T')[0];
      const displayStatus = (ride.date < todayDateString && (ride.status === 'active' || ride.status === 'scheduled')) ? 'cancelled' : ride.status;

      const availableCountVal = stats.availableCount;
      const notAvailableCountVal = stats.notAvailableCount;
      const noResponseCountVal = stats.noResponseCount;

      return [
        ride.date,
        `"${ride.routeName}"`,
        `"${ride.driverName || 'Unassigned'}"`,
        `"${schedule}"`,
        displayStatus,
        availableCountVal.toString(),
        notAvailableCountVal.toString(),
        noResponseCountVal.toString()
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `rides_export_${getDateString(0)}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredAllRides, allAvailabilityMap, routes]);

  const handleMarkCompleted = async (ride: RideWithMeta) => {
    setIsMarkingCompleted(true);
    try {
      const collectionName = COLLECTIONS.RIDES;
      await updateDoc(doc(db, collectionName, ride.rideId), {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
      const collectionName = COLLECTIONS.RIDES;
      await updateDoc(doc(db, collectionName, cancelRideTarget.rideId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
      const [activeRoutesSnap, existingTodaySnap, driversSnap] = await Promise.all([
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
        getDocs(
          query(
            collection(db, COLLECTIONS.USERS),
            where("role", "==", "driver"),
            where("status", "in", ["active", "approved"])
          )
        )
      ]);

      const existingRouteIds = new Set(
        existingTodaySnap.docs.map(
          (rideDoc) => (rideDoc.data() as Ride).routeId,
        ),
      );

      const driversList = driversSnap.docs.map(doc => ({ uid: doc.id, fullName: doc.data().fullName || "Unknown Driver" }));

      const activeRoutes = activeRoutesSnap.docs.map((routeDoc) => ({
        ...(routeDoc.data() as Route),
        routeId: routeDoc.id,
      }));

      const routesToCreate = activeRoutes.filter((route) => {
        if (existingRouteIds.has(route.routeId)) return false;
        const assignedIds = getRouteAssignedDriverIds(route);
        return assignedIds.length > 0;
      });

      if (routesToCreate.length === 0) {
        toast("All active valid routes already have today's rides");
        return;
      }

      setDispatchRoutes(routesToCreate);
      setDispatchDrivers(driversList);
      setDispatchModalOpen(true);
    } catch (error) {
      console.error("Error creating today's rides:", error);
      toast.error("Failed to prepare today's rides");
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
              .sort((a, b) =>
                String(a.departureTime).localeCompare(String(b.departureTime)),
              )
              .map((ride) => {
                const route = routes.find(r => r.routeId === ride.routeId);
                const studentIds = route?.studentIds || [];
                
                const stats = getStudentAvailabilityStats(studentIds, ride.routeId, todayAvailabilityMap);
                const driverProfile = studentsById.get((ride as any).driverId || ride.assignedDriverId);
                const enrichedRide = {
                  ...ride,
                  driverName: driverProfile?.fullName || ride.driverName,
                  vehicleType: driverProfile?.vehicleType || (ride as any).vehicleType,
                  vehiclePlate: driverProfile?.vehiclePlate || (ride as any).vehiclePlate
                };

                return (
                  <RideCard
                    key={ride.rideId}
                    ride={enrichedRide as any}
                    isEarlyRide={false}
                    availableStudentsCount={stats.availableCount}
                    notAvailableStudentsCount={stats.notAvailableCount}
                    noResponseCount={stats.noResponseCount}
                    studentsById={allStudentsById}
                    onViewDetails={() => setDetailModalRide({
                      ...enrichedRide,
                      availabilityStats: {
                        available: stats.availableCount,
                        notAvailable: stats.notAvailableCount,
                        noResponse: stats.noResponseCount
                      }
                    } as any)}
                    onCancelRide={() => setCancelRideTarget(ride)}
                    onMarkCompleted={() => void handleMarkCompleted(ride)}
                  />
                );
              })}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text)]">All Rides</h2>
          <button
            type="button"
            onClick={exportToCSV}
            className="bg-[#1e3a5f] hover:bg-[#152a45] text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors duration-200 shadow-sm"
          >
            <Download className="h-4 w-4 stroke-current" />
            Export CSV
          </button>
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
              <option value="cancelled">Cancelled (Manual)</option>
              <option value="auto_cancelled">Cancelled (Auto)</option>
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
                    Schedule
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Available Students
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                {filteredAllRides.map((ride) => {
                  const route = routes.find(r => r.routeId === ride.routeId);
                  const studentIds = route?.studentIds || [];
                  const stats = getStudentAvailabilityStats(studentIds, ride.routeId, allAvailabilityMap, ride.date);
                  const availableCount = stats.availableCount;
                  return (
                    <tr
                      key={ride.rideId}
                      onClick={() => setDetailModalRide({
                        ...ride,
                        availabilityStats: {
                          available: stats.availableCount,
                          notAvailable: stats.notAvailableCount,
                          noResponse: stats.noResponseCount
                        }
                      } as any)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        <span className="font-semibold text-slate-900">
                          {ride.routeName}
                        </span>
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
                        <div className="flex flex-col gap-1 text-xs">
                          {ride.departureTime && <span>Dep: {formatTimeTo12Hour(ride.departureTime)}</span>}
                          {ride.returnTime && <span>Ret: {formatTimeTo12Hour(ride.returnTime)}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <RideStatusBadge status={ride.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {availableCount ?? 0}
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
                      colSpan={7}
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

      <DailyDispatchModal
        open={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        routesToCreate={dispatchRoutes}
        driversList={dispatchDrivers}
        todayString={todayString}
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
