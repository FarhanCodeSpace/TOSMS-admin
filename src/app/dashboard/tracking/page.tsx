"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import {
  Bus,
  CheckCircle2,
  Clock3,
  History,
  Radio,
  Users,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";

import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type {
  Availability,
  EarlyRideRequest,
  LiveLocation,
  Ride,
  Route,
  User,
} from "@/types";
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
import { buildAvailabilityMap, getStudentAvailabilityStats } from "@/utils/availabilityHelpers";

const TrackingMap = dynamic(() => import("@/components/tracking/TrackingMap"), {
  ssr: false,
});

export type ActiveTrackingRide = {
  driverId: string;
  rideId: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  updatedAt?: Timestamp;
  heading?: number;
  driverName: string;
  driverAvatarUrl?: string;
  driverInitials: string;
  vehicleType?: User["vehicleType"];
  vehiclePlate?: string;
  routeId?: string;
  routeName: string;
  routeStops: Route["stops"];
  completedStops?: (string | number)[];
  studentCountToday: number;
  availabilityStats?: { available: number; notAvailable: number; noResponse: number };
  isEarlyRide?: boolean;
};

type RideWithMeta = Ride & {
  activeAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  scheduledAt?: Timestamp;
};

type ViewMode = "live" | "today" | "all" | "custom";

const VALID_RIDE_STATUSES: Ride["status"][] = [
  "scheduled",
  "active",
  "completed",
  "cancelled",
  "auto_cancelled",
];

function formatUpdatedAgo(
  timestamp: Timestamp | undefined,
  nowMs: number,
): string {
  if (!timestamp) return "Updated just now";
  const diffSeconds = Math.max(
    0,
    Math.floor((nowMs - timestamp.toDate().getTime()) / 1000),
  );
  return `Updated ${diffSeconds} seconds ago`;
}

function formatSpeed(speed: number | undefined): string {
  if (typeof speed !== "number" || Number.isNaN(speed)) return "0 km/h";
  return `${Math.max(0, Math.round(speed))} km/h`;
}

function speedMetersPerSecondToKmh(speed: number | undefined): number {
  if (typeof speed !== "number" || Number.isNaN(speed)) return 0;
  return Math.max(0, speed) * 3.6;
}

function formatClockTime(date: Date | null): string {
  if (!date) return "Waiting for data";
  return date.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function rideDateKey(ride: Ride): string {
  if (ride.date) return ride.date;
  const createdAt = ride.createdAt as unknown;
  if (
    createdAt &&
    typeof createdAt === "object" &&
    "toDate" in (createdAt as { toDate?: unknown }) &&
    typeof (createdAt as { toDate: () => Date }).toDate === "function"
  ) {
    return format((createdAt as { toDate: () => Date }).toDate(), "yyyy-MM-dd");
  }
  return "";
}

function RideStatusBadge({ status }: { status: Ride["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    );
  }

  if (status === "scheduled") {
    return (
      <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
        Scheduled
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Completed
      </span>
    );
  }

  if (status === "auto_cancelled" || status === "cancelled" || (status as string) === "not_completed") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
      Cancelled
    </span>
  );
}

function EarlyRideBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Zap fill="currentColor" size={12} />
      Early Ride
    </span>
  );
}

type RideDetailModalProps = {
  ride: RideWithMeta | null;
  isEarlyRide: boolean;
  onClose: () => void;
  onGoLive: (() => void) | null;
};

function RideDetailModal({
  ride,
  isEarlyRide,
  onClose,
  onGoLive,
}: RideDetailModalProps) {
  if (!ride) return null;

  const todayDateString = new Date().toISOString().split('T')[0];
  const displayStatus = (ride.date < todayDateString && (ride.status === 'active' || ride.status === 'scheduled')) ? 'cancelled' : ride.status;

  return (
    <Modal open={Boolean(ride)} onClose={onClose} title="Ride Details">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-slate-900">{ride.routeName}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {isEarlyRide ? <EarlyRideBadge /> : null}
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
                {rideDateKey(ride)
                  ? formatDateDisplay(rideDateKey(ride))
                  : "N/A"}
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

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex justify-between items-center px-1">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Available</span>
              <span className="text-sm font-bold text-emerald-600">
                {(ride as any).availabilityStats?.available || 0}
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

        {onGoLive && (displayStatus === 'active' || displayStatus === 'scheduled') ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onGoLive}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Radio className="h-4 w-4" />
              View Live Tracking
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export default function TrackingPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const todayKey = useMemo(() => getTodayString(), []);

  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isRidesLoading, setIsRidesLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [routesById, setRoutesById] = useState<Record<string, Route>>({});
  const [routes, setRoutes] = useState<Route[]>([]);
  const [driversById, setDriversById] = useState<Record<string, User>>({});
  const [allAvailabilityRecords, setAllAvailabilityRecords] = useState<Availability[]>([]);
  const [todayRides, setTodayRides] = useState<RideWithMeta[]>([]);
  const [hydratedRidesById, setHydratedRidesById] = useState<
    Record<string, RideWithMeta>
  >({});
  const [historyRides, setHistoryRides] = useState<RideWithMeta[]>([]);
  const [earlyRideRideIds, setEarlyRideRideIds] = useState<Set<string>>(
    new Set(),
  );

  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [rangeStart, setRangeStart] = useState(getDateString(-365));
  const [rangeEnd, setRangeEnd] = useState(getDateString(7));
  const [routeFilter, setRouteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Ride["status"]>(
    "all",
  );

  const [activeRoutesCount, setActiveRoutesCount] = useState(0);
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedRide, setSelectedRide] = useState<RideWithMeta | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setLiveLocations([]);
      setIsLoadingInitialData(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.LIVE_LOCATIONS),
      (snapshot) => {
        const locations = snapshot.docs.map((locationDoc) => {
          const data = locationDoc.data() as LiveLocation;
          return {
            ...data,
            driverId: data.driverId || locationDoc.id,
          } as LiveLocation;
        });

        setLiveLocations(locations);
        setLastRefreshAt(new Date());
        setIsLoadingInitialData(false);
      },
      (error) => {
        console.error("Live locations subscription failed:", error);
        setIsLoadingInitialData(false);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setRoutes([]);
      setRoutesById({});
      setActiveRoutesCount(0);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.ROUTES),
      (snapshot) => {
        const routesList = snapshot.docs.map((routeDoc) => ({
          ...(routeDoc.data() as Route),
          routeId: routeDoc.id,
        }));

        const routesMap: Record<string, Route> = {};
        routesList.forEach((route) => {
          routesMap[route.routeId] = route;
        });

        setRoutes(routesList);
        setRoutesById(routesMap);
        setActiveRoutesCount(
          routesList.filter((route) => route.isActive === true).length,
        );
      },
      (error) => {
        console.error("Routes subscription failed:", error);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setAllAvailabilityRecords([]);
      return;
    }

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
      (error) => {
        console.error("Availability subscription failed:", error);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser, rangeStart, rangeEnd]);

  const allAvailabilityMap = useMemo(() => buildAvailabilityMap(allAvailabilityRecords, true), [allAvailabilityRecords]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setTodayRides([]);
      setIsRidesLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.RIDES),
        where("date", "==", todayKey),
      ),
      (snapshot) => {
        const rides = snapshot.docs.map((rideDoc) => {
          const data = rideDoc.data() as RideWithMeta;
          return {
            ...data,
            rideId: rideDoc.id,
            status: VALID_RIDE_STATUSES.includes(data.status)
              ? data.status
              : "scheduled",
          };
        });
        setTodayRides(rides);
        setIsRidesLoading(false);
      },
      (error) => {
        console.error("Error fetching today's rides for live tracking:", error);
        setIsRidesLoading(false);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser, todayKey]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setHistoryRides([]);
      setIsHistoryLoading(false);
      return;
    }

    if (viewMode !== "all" && viewMode !== "custom") return;

    let cancelled = false;
    setIsHistoryLoading(true);

    getDocs(
      query(
        collection(db, COLLECTIONS.RIDES),
        where("date", ">=", rangeStart),
        where("date", "<=", rangeEnd),
      ),
    )
      .then((snapshot) => {
        if (cancelled) return;
        const rides = snapshot.docs.map((rideDoc) => {
          const data = rideDoc.data() as RideWithMeta;
          return {
            ...data,
            rideId: rideDoc.id,
            status: VALID_RIDE_STATUSES.includes(data.status)
              ? data.status
              : "scheduled",
          };
        });
        setHistoryRides(rides);
      })
      .catch((error) => {
        console.error("Error fetching ride history:", error);
        if (!cancelled) {
          setHistoryRides([]);
          toast.error("Failed to load ride history");
        }
      })
      .finally(() => {
        if (!cancelled) setIsHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser, viewMode, rangeStart, rangeEnd]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setEarlyRideRideIds(new Set());
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.EARLY_RIDE_REQUESTS),
      (snapshot) => {
        const rideIds = new Set<string>();
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as EarlyRideRequest;
          if (data.rideId) rideIds.add(data.rideId);
        });
        setEarlyRideRideIds(rideIds);
      },
      (error) => {
        console.error("Early ride requests subscription failed:", error);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setDriversById({});
      setHydratedRidesById({});
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      const driverIds = Array.from(
        new Set(
          liveLocations.map((location) => location.driverId).filter(Boolean),
        ),
      );
      const rideIds = Array.from(
        new Set(liveLocations.map((location) => location.rideId).filter(Boolean)),
      );

      const missingRideIds = rideIds.filter(
        (rideId) => !todayRides.some((ride) => ride.rideId === rideId),
      );

      const [driverPairs, ridePairs] = await Promise.all([
        Promise.all(
          driverIds.map(async (driverId) => {
            const driverSnap = await getDoc(doc(db, COLLECTIONS.USERS, driverId));
            if (!driverSnap.exists()) return null;
            return [
              driverId,
              { ...(driverSnap.data() as User), uid: driverId },
            ] as const;
          }),
        ),
        Promise.all(
          missingRideIds.map(async (rideId) => {
            const rideSnap = await getDoc(doc(db, COLLECTIONS.RIDES, rideId));
            if (!rideSnap.exists()) return null;
            const data = rideSnap.data() as RideWithMeta;
            return [
              rideId,
              {
                ...data,
                rideId,
                status: VALID_RIDE_STATUSES.includes(data.status)
                  ? data.status
                  : "scheduled",
              },
            ] as const;
          }),
        ),
      ]);

      if (cancelled) return;

      const nextDriversById: Record<string, User> = {};
      driverPairs.forEach((pair) => {
        if (!pair) return;
        nextDriversById[pair[0]] = pair[1];
      });

      const nextHydratedRidesById: Record<string, RideWithMeta> = {};
      ridePairs.forEach((pair) => {
        if (!pair) return;
        nextHydratedRidesById[pair[0]] = pair[1];
      });

      setDriversById(nextDriversById);
      setHydratedRidesById(nextHydratedRidesById);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser, liveLocations, todayRides]);

  const ridesById = useMemo(() => {
    const map: Record<string, RideWithMeta> = {
      ...hydratedRidesById,
    };
    todayRides.forEach((ride) => {
      map[ride.rideId] = ride;
    });
    return map;
  }, [hydratedRidesById, todayRides]);

  const activeTrackingRides = useMemo<ActiveTrackingRide[]>(() => {
    const locationByRideId = new Map<string, LiveLocation>();
    const locationByDriverId = new Map<string, LiveLocation>();
    liveLocations.forEach((location) => {
      if (location.rideId) locationByRideId.set(location.rideId, location);
      if (location.driverId) locationByDriverId.set(location.driverId, location);
    });

    const rides: ActiveTrackingRide[] = [];

    Object.values(ridesById).forEach((ride) => {
      if (ride.status !== "active") return;

      const location =
        locationByRideId.get(ride.rideId) ||
        locationByDriverId.get(ride.assignedDriverId);

      const driver = location
        ? driversById[location.driverId]
        : driversById[ride.assignedDriverId];
      const route = routesById[ride.routeId];

      const studentIds = route?.studentIds || [];
      const stats = getStudentAvailabilityStats(studentIds, ride.routeId || "", allAvailabilityMap, todayKey);

      rides.push({
        driverId: location?.driverId || ride.assignedDriverId || ride.rideId,
        rideId: ride.rideId,
        latitude: location?.latitude,
        longitude: location?.longitude,
        speed: location ? speedMetersPerSecondToKmh(location.speed) : undefined,
        heading: location?.heading,
        updatedAt: location?.updatedAt,
        driverName: driver?.fullName || ride.driverName || "Unknown Driver",
        driverAvatarUrl: driver?.profileImageUrl,
        driverInitials: getInitials(driver?.fullName || ride.driverName || "Driver"),
        vehicleType: driver?.vehicleType,
        vehiclePlate: driver?.vehiclePlate,
        routeId: ride.routeId,
        routeName: ride.routeName || route?.routeName || "Route unavailable",
        routeStops: route?.stops || [],
        completedStops: ride.completedStops || [],
        studentCountToday: stats.availableCount,
        availabilityStats: {
          available: stats.availableCount,
          notAvailable: stats.notAvailableCount,
          noResponse: stats.noResponseCount,
        },
        isEarlyRide: earlyRideRideIds.has(ride.rideId),
      });
    });

    return rides.sort((a, b) => {
      const aHasLocation =
        Number.isFinite(a.latitude) && Number.isFinite(a.longitude);
      const bHasLocation =
        Number.isFinite(b.latitude) && Number.isFinite(b.longitude);
      if (aHasLocation !== bHasLocation) return aHasLocation ? 1 : -1;
      const aMs = a.updatedAt?.toDate().getTime() || 0;
      const bMs = b.updatedAt?.toDate().getTime() || 0;
      return bMs - aMs;
    });
  }, [
    liveLocations,
    driversById,
    ridesById,
    routesById,
    allAvailabilityMap,
    earlyRideRideIds,
    todayKey,
  ]);

  const liveList = useMemo(() => {
    return activeTrackingRides.filter(
      (ride) => routeFilter === "all" || ride.routeId === routeFilter,
    );
  }, [activeTrackingRides, routeFilter]);



  const filteredHistoryRides = useMemo(() => {
    let list: RideWithMeta[] = [];
    if (viewMode === "today") {
      list = todayRides;
    } else if (viewMode === "all" || viewMode === "custom") {
      list = historyRides;
    }

    if (routeFilter !== "all") {
      list = list.filter((ride) => ride.routeId === routeFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((ride) => ride.status === statusFilter);
    }

    return [...list].sort((a, b) => {
      const dateCompare = rideDateKey(b).localeCompare(rideDateKey(a));
      if (dateCompare !== 0) return dateCompare;
      return String(a.departureTime).localeCompare(String(b.departureTime));
    }).map(ride => {
      const route = routesById[ride.routeId];
      const studentIds = route?.studentIds || [];
      const stats = getStudentAvailabilityStats(studentIds, ride.routeId || "", allAvailabilityMap, rideDateKey(ride));
      return {
        ...ride,
        availabilityStats: {
          available: stats.availableCount,
          notAvailable: stats.notAvailableCount,
          noResponse: stats.noResponseCount,
        }
      } as any;
    });
  }, [viewMode, todayRides, historyRides, routeFilter, statusFilter, routesById, allAvailabilityMap]);

  const activeRouteIds = useMemo(() => {
    return new Set(
      activeTrackingRides
        .map((ride) => ride.routeId)
        .filter(Boolean) as string[],
    );
  }, [activeTrackingRides]);

  const routesNotStarted = Math.max(activeRoutesCount - activeRouteIds.size, 0);

  const goLive = (ride: RideWithMeta) => {
    setViewMode("live");
    setSelectedRide(null);
    if (ride.status === "active") {
      const liveRide = activeTrackingRides.find(
        (item) => item.rideId === ride.rideId,
      );
      if (liveRide) {
        setSelectedRideId(liveRide.rideId);
        setFocusedDriverId(liveRide.driverId);
      }
    }
  };

  const isLiveToday = (ride: RideWithMeta) => rideDateKey(ride) === todayKey;

  useEffect(() => {
    if (liveList.length === 0) {
      if (selectedRideId !== null) setSelectedRideId(null);
      return;
    }
    if (selectedRideId === null || !liveList.some((r) => r.rideId === selectedRideId)) {
      setSelectedRideId(liveList[0].rideId);
    }
  }, [liveList, selectedRideId]);

  const tabList: { key: ViewMode; label: string; icon: typeof Radio }[] = [
    { key: "live", label: "Live Now", icon: Radio },
    { key: "today", label: "Today", icon: Clock3 },
    { key: "all", label: "All Time", icon: History },
    { key: "custom", label: "Custom", icon: Bus },
  ];

  return (
    <section className="flex h-[calc(100vh-7rem)] min-h-[620px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {tabList.map(({ key, label, icon: TabIcon }) => {
            const active = viewMode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setViewMode(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <TabIcon className="h-3.5 w-3.5" />
                {label}
                {key === "live" ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    {liveList.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {viewMode === "custom" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500"
            />
            <span className="text-xs font-semibold text-slate-500">to</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500"
            />
          </div>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="all">All Routes</option>
            {routes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.routeName}
              </option>
            ))}
          </select>

          {viewMode !== "live" ? (
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | Ride["status"],
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="flex h-full w-[26rem] flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="text-lg font-semibold text-[var(--text)]">
                  {viewMode === "live" ? "Active Rides" : "Ride History"}
                </h1>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {viewMode === "live" ? liveList.length : filteredHistoryRides.length}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingInitialData ||
            isRidesLoading ||
            (viewMode !== "live" && isHistoryLoading) ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-2/3 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-3/4 animate-pulse rounded bg-slate-200" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === "live" && liveList.length === 0 ? (
              <EmptyState
                icon={<Bus className="h-8 w-8" />}
                title="No active rides right now"
                subtitle="Rides will appear here when drivers start their routes, and will disappear as soon as they end."
              />
            ) : viewMode !== "live" && filteredHistoryRides.length === 0 ? (
              <EmptyState
                icon={<Bus className="h-8 w-8" />}
                title="No rides found"
                subtitle="Try changing the date range, route, or status filters."
              />
            ) : viewMode === "live" ? (
              <div className="space-y-3">
                {liveList.map((ride) => {
                  const isSelected = selectedRideId === ride.rideId;

                  return (
                    <button
                      key={`${ride.driverId}_${ride.rideId}`}
                      type="button"
                      onClick={() => {
                        setSelectedRideId(ride.rideId);
                        setFocusedDriverId(ride.driverId);
                      }}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 shadow-sm"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                          {ride.driverAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ride.driverAvatarUrl}
                              alt={ride.driverName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            ride.driverInitials
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--text)]">
                              {ride.driverName}
                            </p>
                            {ride.isEarlyRide ? <EarlyRideBadge /> : null}
                          </div>
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            {ride.routeName}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                            {Number.isFinite(ride.latitude) &&
                            Number.isFinite(ride.longitude) ? (
                              <>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                                  {formatSpeed(ride.speed)}
                                </span>
                                <span>{formatUpdatedAgo(ride.updatedAt, nowMs)}</span>
                              </>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                                Waiting for GPS location…
                              </span>
                            )}
                          </div>
                          
                          <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold">
                            <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                              {ride.availabilityStats?.available || 0} Available
                            </div>
                            <div className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-1 rounded">
                              <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                              {ride.availabilityStats?.notAvailable || 0} Not Available
                            </div>
                            <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-1 rounded">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                              {ride.availabilityStats?.noResponse || 0} No Response
                            </div>
                          </div>

                          {ride.routeStops && ride.routeStops.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-[var(--border)]">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Route Timeline</p>
                              <div className="relative flex flex-col gap-3 before:absolute before:inset-y-2 before:left-[11px] before:w-0.5 before:bg-slate-200">
                                {[...ride.routeStops].sort((a, b) => a.order - b.order).map((stop, i) => {
                                  const isCompleted = ride.completedStops?.includes(i) || ride.completedStops?.includes(stop.stopName) || ride.completedStops?.includes(String(i)) || ride.completedStops?.includes(stop.order) || ride.completedStops?.includes(String(stop.order));
                                  return (
                                    <div key={i} className="relative z-10 flex items-center gap-3">
                                      {isCompleted ? (
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                                          <CheckCircle2 size={14} strokeWidth={3} />
                                        </div>
                                      ) : (
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-white text-[10px] font-bold text-emerald-600">
                                          {i + 1}
                                        </div>
                                      )}
                                      <p className={`truncate text-xs font-medium ${isCompleted ? 'text-emerald-700' : 'text-slate-600'}`}>{stop.stopName}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistoryRides.map((ride) => {
                  const isEarly = earlyRideRideIds.has(ride.rideId);
                  const todayDateString = new Date().toISOString().split('T')[0];
                  const displayStatus = (ride.date < todayDateString && (ride.status === 'active' || ride.status === 'scheduled')) ? 'cancelled' : ride.status;
                  const isLive = displayStatus === "active";

                  return (
                    <div
                      key={ride.rideId}
                      className={`w-full rounded-2xl bg-white shadow-md overflow-hidden text-left transition hover:shadow-lg border-t-[6px] ${
                        displayStatus === "scheduled" ? "border-t-blue-500" :
                        (displayStatus === "active" || displayStatus === "completed") ? "border-t-emerald-500" :
                        "border-t-red-500"
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <p className="truncate text-base font-bold text-slate-900">
                              {ride.routeName}
                            </p>
                            {isEarly ? <EarlyRideBadge /> : null}
                          </div>
                          <RideStatusBadge status={displayStatus} />
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
                          <p>
                            {rideDateKey(ride) ? formatDateDisplay(rideDateKey(ride)) : "No date"}
                          </p>
                          <span>•</span>
                          <p>Dep: {formatTimeTo12Hour(ride.departureTime)}</p>
                        </div>

                        <div className="mt-3">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 pr-3 pl-1 py-1 text-xs font-medium text-slate-700">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                              {(ride as any).driverAvatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={(ride as any).driverAvatarUrl} alt={ride.driverName} className="h-full w-full object-cover" />
                              ) : (
                                (ride as any).driverInitials || <Users className="h-3 w-3" />
                              )}
                            </div>
                            <span className="truncate">{ride.driverName || "Unassigned"}</span>
                          </div>
                        </div>

                        <hr className="my-3 border-gray-100" />

                        <div className="flex justify-between items-center px-1">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Available</span>
                            <span className="text-sm font-bold text-emerald-600">
                              {(ride as any).availabilityStats?.available || 0}
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
                        
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRide(ride)}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 text-center"
                          >
                            View Details
                          </button>
                          {isLive ? (
                            <button
                              type="button"
                              onClick={() => goLive(ride)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                            >
                              <Radio className="h-4 w-4" />
                              Live
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="min-h-0 flex-1">
            <TrackingMap
              activeRides={selectedRideId ? activeTrackingRides.filter(r => r.rideId === selectedRideId) : activeTrackingRides}
              selectedRideId={selectedRideId}
              focusedDriverId={focusedDriverId}
              onDriverSelect={setFocusedDriverId}
              isLoadingInitialData={isLoadingInitialData}
            />
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2 text-xs">
            <div className="flex items-center gap-4 text-[var(--text-secondary)]">
              <span>
                Active drivers:{" "}
                <strong className="text-[var(--text)]">
                  {activeTrackingRides.length}
                </strong>
              </span>
              <span>
                Last refresh:{" "}
                <strong className="text-[var(--text)]">
                  {formatClockTime(lastRefreshAt)}
                </strong>
              </span>
            </div>

            {routesNotStarted > 0 ? (
              <span className="font-semibold text-amber-600">
                {routesNotStarted} route{routesNotStarted > 1 ? "s" : ""} not yet
                started
              </span>
            ) : (
              <span className="font-semibold text-emerald-600">
                All systems operational
              </span>
            )}
          </div>
        </div>
      </div>

      <RideDetailModal
        ride={selectedRide}
        isEarlyRide={selectedRide ? earlyRideRideIds.has(selectedRide.rideId) : false}
        onClose={() => setSelectedRide(null)}
        onGoLive={() => selectedRide && goLive(selectedRide)}
      />
    </section>
  );
}
