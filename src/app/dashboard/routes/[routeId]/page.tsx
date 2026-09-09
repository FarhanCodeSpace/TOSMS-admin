"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Clock,
  Users,
  Zap,
  ChevronLeft,
  Edit,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { Route, User as UserType, Availability } from "@/types";
import { formatTimeTo12Hour } from "@/utils/formatters";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { deleteRoute } from "@/utils/firestoreHelpers";
import { getRouteAssignedDriverIds } from "@/utils/routeAssignments";

const RouteDetailMap = dynamic(
  () => import("@/components/routes/RouteDetailMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
        <span className="text-gray-400">Loading map...</span>
      </div>
    ),
  },
);

export default function RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params?.routeId as string;

  const [route, setRoute] = useState<Route | null>(null);
  const [drivers, setDrivers] = useState<UserType[]>([]);
  const [students, setStudents] = useState<UserType[]>([]);
  const [todayAvailability, setTodayAvailability] = useState<Availability[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch route
  useEffect(() => {
    if (!routeId) return;

    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.ROUTES, routeId),
      async (snapshot) => {
        if (snapshot.exists()) {
          const routeData = {
            ...snapshot.data(),
            routeId: snapshot.id,
          } as Route;
          setRoute(routeData);

          const assignedDriverIds = getRouteAssignedDriverIds(routeData);
          if (assignedDriverIds.length > 0) {
            const driverSnaps = await Promise.all(
              assignedDriverIds.map((driverId) => getDoc(doc(db, COLLECTIONS.USERS, driverId))),
            );
            setDrivers(
              driverSnaps
                .filter((driverSnap) => driverSnap.exists())
                .map((driverSnap) => ({
                  ...(driverSnap.data() as UserType),
                  uid: driverSnap.id,
                })),
            );
          } else {
            setDrivers([]);
          }

          // Fetch assigned students from routeData.studentIds
          const studentIds = routeData.studentIds || [];
          if (studentIds.length > 0) {
            const batches = [];
            for (let i = 0; i < studentIds.length; i += 30) {
              const batchIds = studentIds.slice(i, i + 30);
              batches.push(
                getDocs(
                  query(
                    collection(db, COLLECTIONS.USERS),
                    where("__name__", "in", batchIds)
                  )
                )
              );
            }
            const snaps = await Promise.all(batches);
            const studentsList = snaps
              .flatMap((s) => s.docs.map((d) => ({ ...d.data(), uid: d.id })))
              .filter((u: any) => u.role === "student") as UserType[];
            setStudents(studentsList);
          } else {
            setStudents([]);
          }
        }
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [routeId]);

  // Fetch today's availability
  useEffect(() => {
    if (!routeId) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("routeId", "==", routeId),
        where("date", "==", today),
      ),
      (snapshot) => {
        const availability = snapshot.docs.map((d) => ({
          ...d.data(),
          availabilityId: d.id,
        })) as Availability[];
        setTodayAvailability(availability);
      },
    );

    return () => unsubscribe();
  }, [routeId]);

  const getTodayAvailability = (studentId: string) => {
    const record = todayAvailability.find((a) => a.userId === studentId);
    return record?.isAvailable ?? null;
  };

  const availabilitySummary = useMemo(() => {
    const available = todayAvailability.filter((a) => a.isAvailable).length;
    const unavailable = todayAvailability.filter((a) => !a.isAvailable).length;
    const notMarked = students.length - available - unavailable;

    return { available, unavailable, notMarked };
  }, [todayAvailability, students]);

  const handleDeleteRoute = async () => {
    if (!route) return;

    setIsDeleting(true);
    try {
      await deleteRoute(route.routeId);
      toast.success("Route deleted successfully");
      router.push("/dashboard/routes");
    } catch (error) {
      console.error("Error deleting route:", error);
      toast.error("Failed to delete route");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader rows={2} className="max-w-md" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </div>
        <SkeletonLoader variant="table" rows={6} />
      </div>
    );
  }

  if (!route) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8" />}
        title="Route not found"
        subtitle="This route may have been deleted or you may not have access to it."
        actionLabel="Back to Routes"
        actionHref="/dashboard/routes"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/routes"
            className="p-2 hover:bg-slate-100 rounded transition"
          >
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {route.routeName}
            </h1>
            <p className="text-sm text-slate-600">{route.description}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/routes`}
          className="px-4 py-2 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition inline-flex items-center gap-2"
        >
          <Edit size={18} />
          Edit Route
        </Link>
      </div>

      {/* Route Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-slate-600" />
            <span className="text-sm text-slate-600">Schedule</span>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {route.departureTime && route.returnTime
              ? `${formatTimeTo12Hour(route.departureTime)} - ${formatTimeTo12Hour(route.returnTime)}`
              : route.departureTime
                ? formatTimeTo12Hour(route.departureTime)
                : route.returnTime
                  ? formatTimeTo12Hour(route.returnTime)
                  : ""}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-slate-600" />
            <span className="text-sm text-slate-600">Students</span>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {route.studentIds?.length || 0} / 30
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={18} className="text-slate-600" />
            <span className="text-sm text-slate-600">Stops</span>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {route.stops?.length || 0}
          </p>
        </div>


      </div>

      {/* Map */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Route Map</h2>
        <RouteDetailMap stops={route.stops || []} />
      </div>

      {/* Driver Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Assigned Drivers
          </h2>
        </div>

        {drivers.length > 0 ? (
          <div className="grid gap-3">
            {drivers.map((driver) => (
              <div key={driver.uid} className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                  {(driver.fullName || "").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{driver.fullName}</p>
                  <p className="text-sm text-slate-600">{driver.phone}</p>
                  <p className="text-xs text-slate-500">
                    Vehicle: {driver.vehicleType || "N/A"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-600">
            <p>No drivers assigned</p>
          </div>
        )}
      </div>

      {/* Today's Availability Summary */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Available Today
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {availabilitySummary.available}
            </div>
            <p className="text-sm text-slate-600">Available</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-rose-600">
              {availabilitySummary.unavailable}
            </div>
            <p className="text-sm text-slate-600">Unavailable</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-400">
              {availabilitySummary.notMarked}
            </div>
            <p className="text-sm text-slate-600">Not Marked</p>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">
            Assigned Students ({students.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-200">
          {students.map((student) => {
            const availability = getTodayAvailability(student.uid);
            return (
              <div
                key={student.uid}
                className="px-6 py-4 hover:bg-slate-50 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                    {(student.fullName || "").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {student.fullName}
                    </p>
                    <p className="text-sm text-slate-600">{student.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-600">
                      Pickup Stop
                    </p>
                    <p className="text-slate-900">
                      {(student.routeStops && student.routeStops[routeId]?.pickupStop) || student.pickupStop || "-"}
                    </p>
                  </div>
                  <div>
                    {availability === null ? (
                      <Badge status="pending">Not Marked</Badge>
                    ) : availability ? (
                      <Badge status="available">Available</Badge>
                    ) : (
                      <Badge status="unavailable">Unavailable</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {students.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            No students assigned to this route
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-rose-100 p-2 text-rose-700">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-rose-900">Danger Zone</h2>
            <p className="mt-1 text-sm text-rose-700">
              Deleting this route will remove it from the system and clear it
              from any assigned driver or students.
            </p>
            <div className="mt-4 rounded-xl border border-rose-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Delete this route
                  </p>
                  <p className="text-sm text-slate-600">
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  Delete Route
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Route?"
        message={`Delete ${route.routeName}? This will remove the route and clear it from any assigned driver or students.`}
        confirmLabel="Delete"
        destructive
        isLoading={isDeleting}
        onConfirm={handleDeleteRoute}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
