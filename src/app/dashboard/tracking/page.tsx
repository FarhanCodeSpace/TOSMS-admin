"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { Bus } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Availability, LiveLocation, Ride, Route, User } from "@/types";
import { getTodayString } from "@/utils/dateHelpers";
import { getInitials } from "@/utils/formatters";

const TrackingMap = dynamic(() => import("@/components/tracking/TrackingMap"), {
  ssr: false,
});

export type ActiveTrackingRide = {
  driverId: string;
  rideId: string;
  latitude: number;
  longitude: number;
  speed: number;
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
  studentCountToday: number;
};

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

export default function TrackingPage() {
  const todayKey = useMemo(() => getTodayString(), []);

  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [ridesById, setRidesById] = useState<Record<string, Ride>>({});
  const [routesById, setRoutesById] = useState<Record<string, Route>>({});
  const [driversById, setDriversById] = useState<Record<string, User>>({});
  const [availableStudentsByRoute, setAvailableStudentsByRoute] = useState<
    Record<string, number>
  >({});

  const [activeRoutesCount, setActiveRoutesCount] = useState(0);
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(ticker);
  }, []);

  useEffect(() => {
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
      () => {
        setIsLoadingInitialData(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.ROUTES), where("isActive", "==", true)),
      (snapshot) => {
        setActiveRoutesCount(snapshot.docs.length);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("date", "==", todayKey),
      ),
      (snapshot) => {
        const routeCounts: Record<string, number> = {};

        snapshot.docs.forEach((availabilityDoc) => {
          const data = availabilityDoc.data() as Availability;
          if (data.role === "student" && data.isAvailable === true) {
            routeCounts[data.routeId] = (routeCounts[data.routeId] || 0) + 1;
          }
        });

        setAvailableStudentsByRoute(routeCounts);
      },
    );

    return () => unsubscribe();
  }, [todayKey]);

  useEffect(() => {
    let cancelled = false;

    const hydrateRelatedData = async () => {
      const driverIds = Array.from(
        new Set(
          liveLocations.map((location) => location.driverId).filter(Boolean),
        ),
      );
      const rideIds = Array.from(
        new Set(
          liveLocations.map((location) => location.rideId).filter(Boolean),
        ),
      );

      const ridePairs = await Promise.all(
        rideIds.map(async (rideId) => {
          const rideSnap = await getDoc(doc(db, COLLECTIONS.RIDES, rideId));
          if (!rideSnap.exists()) return null;
          return [rideId, { ...(rideSnap.data() as Ride), rideId }] as const;
        }),
      );

      const nextRidesById: Record<string, Ride> = {};
      ridePairs.forEach((pair) => {
        if (!pair) return;
        nextRidesById[pair[0]] = pair[1];
      });

      const routeIds = Array.from(
        new Set(
          Object.values(nextRidesById)
            .map((ride) => ride.routeId)
            .filter(Boolean),
        ),
      );

      const [driverPairs, routePairs] = await Promise.all([
        Promise.all(
          driverIds.map(async (driverId) => {
            const driverSnap = await getDoc(
              doc(db, COLLECTIONS.USERS, driverId),
            );
            if (!driverSnap.exists()) return null;
            return [
              driverId,
              { ...(driverSnap.data() as User), uid: driverId },
            ] as const;
          }),
        ),
        Promise.all(
          routeIds.map(async (routeId) => {
            const routeSnap = await getDoc(
              doc(db, COLLECTIONS.ROUTES, routeId),
            );
            if (!routeSnap.exists()) return null;
            return [
              routeId,
              { ...(routeSnap.data() as Route), routeId },
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

      const nextRoutesById: Record<string, Route> = {};
      routePairs.forEach((pair) => {
        if (!pair) return;
        nextRoutesById[pair[0]] = pair[1];
      });

      setRidesById(nextRidesById);
      setDriversById(nextDriversById);
      setRoutesById(nextRoutesById);
    };

    void hydrateRelatedData();

    return () => {
      cancelled = true;
    };
  }, [liveLocations]);

  const activeTrackingRides = useMemo<ActiveTrackingRide[]>(() => {
    return liveLocations
      .map((location) => {
        const driver = driversById[location.driverId];
        const ride = ridesById[location.rideId];
        const route = ride ? routesById[ride.routeId] : undefined;

        return {
          driverId: location.driverId,
          rideId: location.rideId,
          latitude: location.latitude,
          longitude: location.longitude,
          speed: speedMetersPerSecondToKmh(location.speed),
          heading: location.heading,
          updatedAt: location.updatedAt,
          driverName: driver?.fullName || "Unknown Driver",
          driverAvatarUrl: driver?.profileImageUrl,
          driverInitials: getInitials(driver?.fullName || "Driver"),
          vehicleType: driver?.vehicleType,
          vehiclePlate: driver?.vehiclePlate,
          routeId: ride?.routeId,
          routeName: ride?.routeName || route?.routeName || "Route unavailable",
          routeStops: route?.stops || [],
          studentCountToday: ride?.routeId
            ? availableStudentsByRoute[ride.routeId] || 0
            : 0,
        };
      })
      .sort((a, b) => {
        const aMs = a.updatedAt?.toDate().getTime() || 0;
        const bMs = b.updatedAt?.toDate().getTime() || 0;
        return bMs - aMs;
      });
  }, [
    liveLocations,
    driversById,
    ridesById,
    routesById,
    availableStudentsByRoute,
  ]);

  const activeRouteIds = useMemo(() => {
    return new Set(
      activeTrackingRides
        .map((ride) => ride.routeId)
        .filter(Boolean) as string[],
    );
  }, [activeTrackingRides]);

  const routesNotStarted = Math.max(activeRoutesCount - activeRouteIds.size, 0);

  return (
    <section className="flex h-[calc(100vh-7rem)] min-h-[620px] gap-4">
      <aside className="flex h-full w-80 flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-lg font-semibold text-[var(--text)]">
                Active Rides
              </h1>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {activeTrackingRides.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingInitialData ? (
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
          ) : activeTrackingRides.length === 0 ? (
            <EmptyState
              icon={<Bus className="h-8 w-8" />}
              title="No active rides right now"
              subtitle="Rides will appear here when drivers start their routes."
            />
          ) : (
            <div className="space-y-3">
              {activeTrackingRides.map((ride) => {
                const isFocused = focusedDriverId === ride.driverId;

                return (
                  <button
                    key={`${ride.driverId}_${ride.rideId}`}
                    type="button"
                    onClick={() => setFocusedDriverId(ride.driverId)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      isFocused
                        ? "border-emerald-300 bg-emerald-50"
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
                        <p className="truncate text-sm font-semibold text-[var(--text)]">
                          {ride.driverName}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          {ride.routeName}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                            {formatSpeed(ride.speed)}
                          </span>
                          <span>{formatUpdatedAgo(ride.updatedAt, nowMs)}</span>
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-slate-600">
                          {ride.studentCountToday} students available today
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="min-h-0 flex-1">
          <TrackingMap
            activeRides={activeTrackingRides}
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
    </section>
  );
}
