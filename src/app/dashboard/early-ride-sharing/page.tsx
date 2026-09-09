"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";
import { ChevronRight, User as UserIcon, Eye } from "lucide-react";
import toast from "react-hot-toast";

import Badge from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import { formatTimestamp } from "@/utils/formatters";
import type { EarlyRideRequest, Ride, User, Route } from "@/types";
import StudentDetailModal from "@/app/dashboard/students/StudentDetailModal";
import DriverDetailModal from "@/components/drivers/DriverDetailModal";

type EarlyRideRequestRecord = EarlyRideRequest & { id: string };

type EarlyRideDisplayStatus =
  | "waiting"
  | "accepted"
  | "active"
  | "completed"
  | "cancelled";



type StatusFilter = "all" | EarlyRideDisplayStatus;

type SnapshotTimestamp = Timestamp | Date | { toDate?: () => Date } | null | undefined;

function toDate(value: SnapshotTimestamp): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value && value.toDate) {
    return value.toDate();
  }
  return null;
}

function getDisplayStatus(
  request: EarlyRideRequestRecord,
  rideStatus?: Ride["status"],
): EarlyRideDisplayStatus {
  if (request.status === "cancelled" || request.status === "expired") {
    return "cancelled";
  }

  if (rideStatus === "completed") {
    return "completed";
  }

  if (rideStatus === "active") {
    return "active";
  }

  if (rideStatus === "cancelled") {
    return "cancelled";
  }

  if (request.status === "completed") {
    return "completed";
  }

  if (request.status === "accepted") {
    return "accepted";
  }

  return "waiting";
}

function getStatusBadgeProps(status: EarlyRideDisplayStatus) {
  switch (status) {
    case "waiting":
      return { variant: "warning" as const, label: "Requested" };
    case "accepted":
      return { variant: "success" as const, label: "Accepted" };
    case "active":
      return { variant: "active" as const, label: "Active" };
    case "completed":
      return { variant: "success" as const, label: "Completed" };
    case "cancelled":
      return { variant: "error" as const, label: "Cancelled" };
    default:
      return { variant: "default" as const, label: status };
  }
}

function RequestDetails({
  request,
  driver,
  status,
  routes,
  studentsById,
  onViewStudent,
  onViewDriver,
}: {
  request: EarlyRideRequestRecord;
  driver?: User;
  status: EarlyRideDisplayStatus;
  routes: Route[];
  studentsById: Record<string, User>;
  onViewStudent: (student: User) => void;
  onViewDriver: (driver: User) => void;
}) {
  const driverLabel =
    driver?.fullName ?? request.acceptedDriverId ?? "Unassigned";
  const statusBadge = getStatusBadgeProps(status);
  const vehicleLabel = request.vehicle
    ? `${request.vehicle.name} • ${request.vehicle.plateNumber}`
    : driver
      ? [driver.vehicleType, driver.vehiclePlate].filter(Boolean).join(" • ") || "N/A"
      : "N/A";
  
  const routeRecord = routes.find(r => r.routeName === request.route || r.routeId === request.route);
  const sortedStops = [...(routeRecord?.stops || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Route
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--text)]">
            {request.route}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Driver
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text)]">
              {driverLabel}
            </span>
            {driver && (
              <button 
                onClick={() => onViewDriver(driver)}
                className="p-1 hover:bg-[var(--border)] rounded text-[var(--text-muted)] transition-colors"
                title="View Driver Details"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Vehicle
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--text)]">
            {vehicleLabel}
          </p>
        </div>
      </div>

      {sortedStops.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] p-4 overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-4">
            Route Stops
          </p>
          <div className="flex items-center overflow-x-auto pb-2 scrollbar-thin">
            {sortedStops.map((stop, index) => (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-[var(--primary)] border-2 border-[var(--surface)] ring-2 ring-[var(--primary)]" />
                  <span className="mt-2 text-xs font-medium text-[var(--text)] whitespace-nowrap px-2">
                    {stop.stopName}
                  </span>
                </div>
                {index < sortedStops.length - 1 && (
                  <div className="h-0.5 w-16 bg-[var(--primary)] -translate-y-3 opacity-50 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Boys
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">
            {request.boysCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Girls
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">
            {request.girlsCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Assigned drivers
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">
            {request.assignedDriverIds.length}
          </p>
        </Card>
      </div>

      <div className="rounded-2xl border border-[var(--border)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Students Joined
          </h3>
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {request.studentsJoined.length} total
          </span>
        </div>

        {request.studentsJoined.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            No students have joined this request yet.
          </p>
        ) : (
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {request.studentsJoined.map((student) => (
              <div
                key={student.studentId}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {student.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {studentsById[student.studentId]?.university || studentsById[student.studentId]?.universityName || studentsById[student.studentId]?.institute || request.university}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={student.gender === "female" ? "info" : "warning"}
                  >
                    {student.gender}
                  </Badge>
                  {studentsById[student.studentId] && (
                    <button 
                      onClick={() => onViewStudent(studentsById[student.studentId])}
                      className="p-1 hover:bg-[var(--border)] rounded text-[var(--text-muted)] transition-colors"
                      title="View Student Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Created At
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text)]">
            {formatTimestamp(request.createdAt)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Updated At
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text)]">
            {formatTimestamp(request.updatedAt)}
          </p>
        </Card>
      </div>

      {request.rideId && status !== "completed" ? (
        <Link
          href={`/dashboard/live-tracking/${request.rideId}`}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
        >
          {request.status === "accepted" ? "View Live Tracking" : "View Ride"}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

export default function EarlyRideSharingPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const [requests, setRequests] = useState<EarlyRideRequestRecord[]>([]);
  const [ridesById, setRidesById] = useState<Record<string, Ride["status"]>>({});
  const [driversById, setDriversById] = useState<Record<string, User>>({});
  const [studentsById, setStudentsById] = useState<Record<string, User>>({});
  const [routes, setRoutes] = useState<Route[]>([]);
  
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<User | null>(null);
  const [selectedDriverForDetails, setSelectedDriverForDetails] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.EARLY_RIDE_REQUESTS),
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => {
        setRequests(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as EarlyRideRequest),
          })),
        );
        setIsLoading(false);
      },
      (error) => {
        console.error("Early ride requests subscription failed:", error);
        toast.error("Unable to load early ride requests");
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setRidesById({});
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.RIDES),
      (snapshot) => {
        const nextRidesById: Record<string, Ride["status"]> = {};

        snapshot.docs.forEach((rideDoc) => {
          const data = rideDoc.data() as Ride;
          nextRidesById[rideDoc.id] = data.status || "scheduled";
        });

        setRidesById(nextRidesById);
      },
      (error) => {
        console.error("Early ride ride status subscription failed:", error);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setDriversById({});
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "driver")),
      (snapshot) => {
        const nextDrivers: Record<string, User> = {};

        snapshot.docs.forEach((driverDoc) => {
          nextDrivers[driverDoc.id] = { uid: driverDoc.id, ...driverDoc.data() } as User;
        });

        setDriversById(nextDrivers);
      },
      (error) => {
        console.error("Early ride driver lookup failed:", error);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "student")),
      (snapshot) => {
        const nextStudents: Record<string, User> = {};
        snapshot.docs.forEach((doc) => {
          nextStudents[doc.id] = { uid: doc.id, ...doc.data() } as User;
        });
        setStudentsById(nextStudents);
      },
      (error) => console.error("Early ride student lookup failed:", error)
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.ROUTES),
      (snapshot) => {
        setRoutes(snapshot.docs.map(doc => ({ routeId: doc.id, ...doc.data() } as Route)));
      },
      (error) => console.error("Early ride routes lookup failed:", error)
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  const requestsWithDisplayStatus = useMemo(() => {
    return requests.map((request) => ({
      request,
      displayStatus: getDisplayStatus(
        request,
        request.rideId ? ridesById[request.rideId] : undefined,
      ),
    }));
  }, [requests, ridesById]);

  const filteredRequests = useMemo(() => {
    if (activeFilter === "all") return requestsWithDisplayStatus;
    return requestsWithDisplayStatus.filter(
      ({ displayStatus }) => displayStatus === activeFilter,
    );
  }, [activeFilter, requestsWithDisplayStatus]);

  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    return requests.find((request) => request.id === selectedRequestId) ?? null;
  }, [requests, selectedRequestId]);

  const selectedRequestDisplayStatus = useMemo(() => {
    if (!selectedRequest) return null;
    return getDisplayStatus(
      selectedRequest,
      selectedRequest.rideId ? ridesById[selectedRequest.rideId] : undefined,
    );
  }, [ridesById, selectedRequest]);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      waiting: requestsWithDisplayStatus.filter(({ displayStatus }) => displayStatus === "waiting").length,
      accepted: requestsWithDisplayStatus.filter(({ displayStatus }) => displayStatus === "accepted").length,
      active: requestsWithDisplayStatus.filter(({ displayStatus }) => displayStatus === "active").length,
      completed: requestsWithDisplayStatus.filter(({ displayStatus }) => displayStatus === "completed").length,
      cancelled: requestsWithDisplayStatus.filter(({ displayStatus }) => displayStatus === "cancelled").length,
    };
  }, [requests.length, requestsWithDisplayStatus]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Early Ride Sharing"
        subtitle="Monitor real-time requests created in the student and driver mobile apps."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Early Ride Sharing" },
        ]}
      />

      <Card className="p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["all", "All"],
            ["waiting", "Requested"],
            ["accepted", "Accepted"],
            ["active", "Active"],
            ["completed", "Completed"],
            ["cancelled", "Cancelled"],
          ] as const).map(([key, label]) => {
            const active = activeFilter === key;
            const badgeValue = counts[key as keyof typeof counts];

            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {label}
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-[var(--text)]">
                  {badgeValue}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-[var(--surface-secondary)]">
              <tr>
                {[
                  "Requested By",
                  "Route",
                  "University",
                  "Students",
                  "Driver",
                  "Vehicle",
                  "Status",
                  "Created At",
                ].map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-4 py-4" colSpan={8}>
                      <SkeletonLoader rows={1} className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-sm text-[var(--text-muted)]" colSpan={8}>
                    No early ride requests match the current filter.
                  </td>
                </tr>
              ) : (
                filteredRequests.map(({ request, displayStatus }) => {
                  const driver = request.acceptedDriverId
                    ? driversById[request.acceptedDriverId]
                    : undefined;
                  const statusBadge = getStatusBadgeProps(displayStatus);

                  return (
                    <tr
                      key={request.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRequestId(request.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedRequestId(request.id);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-[var(--surface-secondary)]"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-[var(--text)]">
                        {(() => {
                          const primaryStudent = request.studentsJoined?.[0]?.name || "Unknown Student";
                          const extraCount = Math.max(0, (request.studentsJoined?.length || 0) - 1);
                          return extraCount > 0 
                            ? `${primaryStudent} + ${extraCount} other${extraCount > 1 ? "s" : ""}`
                            : primaryStudent;
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[var(--text)]">
                        {request.route}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[var(--text)]">
                        {request.university}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[var(--text)]">
                        <div>{request.studentsJoined.length} total</div>
                        <div className="mt-0.5 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                          <span className="flex items-center gap-1">
                            <UserIcon className="h-3.5 w-3.5 text-blue-500" />
                            <span>{request.boysCount} males</span>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1">
                            <UserIcon className="h-3.5 w-3.5 text-pink-500" />
                            <span>{request.girlsCount} females</span>
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[var(--text)]">
                        {driver?.fullName || request.acceptedDriverId || "Unassigned"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[var(--text)]">
                        {request.vehicle
                          ? request.vehicle.name
                          : driver
                            ? [driver.vehicleType, driver.vehiclePlate].filter(Boolean).join(" • ") || "N/A"
                            : "N/A"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[var(--text-muted)]">
                        {toDate(request.createdAt)
                          ? formatTimestamp(toDate(request.createdAt))
                          : "N/A"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(selectedRequest)}
        onClose={() => setSelectedRequestId(null)}
        title="Early Ride Request Details"
        subtitle={selectedRequest?.requestId || selectedRequest?.id}
        className="max-w-4xl"
      >
        {selectedRequest ? (
          <RequestDetails
            request={selectedRequest}
            driver={
              selectedRequest.acceptedDriverId
                ? driversById[selectedRequest.acceptedDriverId]
                : undefined
            }
            status={selectedRequestDisplayStatus ?? getDisplayStatus(selectedRequest)}
            routes={routes}
            studentsById={studentsById}
            onViewStudent={setSelectedStudentForDetails}
            onViewDriver={setSelectedDriverForDetails}
          />
        ) : null}
      </Modal>

      {selectedStudentForDetails && (
        <StudentDetailModal
          open={true}
          onClose={() => setSelectedStudentForDetails(null)}
          student={selectedStudentForDetails}
          routes={routes}
          feePayments={[]}
        />
      )}

      {selectedDriverForDetails && (
        <DriverDetailModal
          open={true}
          onClose={() => setSelectedDriverForDetails(null)}
          driver={selectedDriverForDetails}
          routes={routes}
        />
      )}
    </div>
  );
}