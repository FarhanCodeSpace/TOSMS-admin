"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { Clock, Edit, Eye, MapPin, Plus, Users } from "lucide-react";
import toast from "react-hot-toast";

import AssignDriverModal from "@/components/routes/AssignDriverModal";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import { Route, User } from "@/types";
import { formatTimeTo12Hour } from "@/utils/formatters";

import CreateRouteModal from "./CreateRouteModal";
import EditRouteModal from "./EditRouteModal";

export default function RoutesPage() {
  const searchParams = useSearchParams();
  const { currentUser, isLoading: authLoading } = useAuth();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assigningRoute, setAssigningRoute] = useState<Route | null>(null);

  useEffect(() => {
    const shouldOpenCreate =
      searchParams.get("create") === "1" ||
      searchParams.get("create") === "true";

    if (shouldOpenCreate) {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!currentUser) {
      setRoutes([]);
      setDrivers([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.ROUTES),
      (snapshot) => {
        const routesList = snapshot.docs.map((routeDoc) => ({
          ...routeDoc.data(),
          routeId: routeDoc.id,
        })) as Route[];

        setRoutes(routesList);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching routes:", error);
        toast.error("Failed to load routes");
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading || !currentUser) {
      setDrivers([]);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "driver")),
      (snapshot) => {
        const driversList = snapshot.docs.map((driverDoc) => ({
          ...driverDoc.data(),
          uid: driverDoc.id,
        })) as User[];

        setDrivers(driversList);
      },
      (error) => {
        console.error("Error fetching drivers:", error);
        toast.error("Failed to load drivers");
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  const handleToggleActive = async (route: Route) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.ROUTES, route.routeId), {
        isActive: !route.isActive,
      });

      toast.success(`Route ${!route.isActive ? "activated" : "deactivated"}`);
    } catch (error) {
      console.error("Error updating route:", error);
      toast.error("Failed to update route");
    }
  };

  const handleEditClick = (route: Route) => {
    setEditingRoute(route);
    setEditModalOpen(true);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text)]">
              Routes Management
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Create, assign, and manage transport routes.
            </p>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Plus size={18} />
            Create Route
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </div>
      ) : routes.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No routes created yet"
          subtitle="Create your first route to start assigning drivers and students."
          actionLabel="Create Route"
          onAction={() => setCreateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((route) => {
            const assignedDriver = drivers.find(
              (driver) => driver.uid === route.assignedDriverId,
            );

            return (
              <div
                key={route.routeId}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="flex-1 text-lg font-bold text-[var(--text)]">
                    {route.routeName}
                  </h3>
                  <div
                    className={`h-3 w-3 rounded-full ${route.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                  />
                </div>

                <div className="mb-4 border-b border-[var(--border)] pb-4">
                  {assignedDriver ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-semibold text-white">
                        {(assignedDriver.fullName || "")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">
                          {assignedDriver.fullName}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {assignedDriver.vehicleType}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      No Driver Assigned
                    </div>
                  )}
                </div>

                <div className="mb-4 space-y-3 border-b border-[var(--border)] pb-4">
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Clock size={16} />
                    <span>
                      {formatTimeTo12Hour(route.departureTime)} -{" "}
                      {formatTimeTo12Hour(route.returnTime)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Badge status="active">
                      <Users size={14} className="mr-1 inline" />
                      {route.studentIds?.length || 0} students
                    </Badge>
                    <Badge status="active">
                      <MapPin size={14} className="mr-1 inline" />
                      {route.stops?.length || 0} stops
                    </Badge>
                  </div>

                  {route.feeAmount ? (
                    <div className="text-sm font-medium text-[var(--text)]">
                      PKR {route.feeAmount.toLocaleString("en-PK")}{" "}
                      <span className="text-xs text-[var(--text-secondary)]">
                        /month
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={route.isActive}
                      onChange={() => handleToggleActive(route)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">
                      {route.isActive ? "Active" : "Inactive"}
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setAssigningRoute(route)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-light)]"
                    >
                      {route.assignedDriverId
                        ? "Change Driver"
                        : "Assign Driver"}
                    </button>

                    <Link
                      href={`/dashboard/routes/${route.routeId}`}
                      className="rounded p-2 transition hover:bg-[var(--surface-secondary)]"
                      title="View route details"
                    >
                      <Eye size={18} className="text-[var(--text-secondary)]" />
                    </Link>

                    <button
                      onClick={() => handleEditClick(route)}
                      className="rounded p-2 transition hover:bg-[var(--surface-secondary)]"
                      title="Edit route"
                    >
                      <Edit
                        size={18}
                        className="text-[var(--text-secondary)]"
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateRouteModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {editingRoute ? (
        <EditRouteModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          route={editingRoute}
        />
      ) : null}

      {assigningRoute ? (
        <AssignDriverModal
          open={!!assigningRoute}
          onClose={() => setAssigningRoute(null)}
          route={assigningRoute}
        />
      ) : null}
    </section>
  );
}
