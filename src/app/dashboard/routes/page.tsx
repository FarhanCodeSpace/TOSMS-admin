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
import { Clock, Edit, Eye, MapPin, Plus, Users, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import { Route, User } from "@/types";
import { formatTimeTo12Hour } from "@/utils/formatters";
import { getRouteAssignedDriverIds } from "@/utils/routeAssignments";
import { deleteRoute } from "@/utils/firestoreHelpers";

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

  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteClick = (route: Route) => {
    setDeletingRoute(route);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRoute) return;
    setIsDeleting(true);
    try {
      await deleteRoute(deletingRoute.routeId);
      toast.success("Route deleted successfully");
    } catch (error) {
      console.error("Error deleting route:", error);
      toast.error("Failed to delete route");
    } finally {
      setIsDeleting(false);
      setDeletingRoute(null);
    }
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
            const assignedDriverIds = getRouteAssignedDriverIds(route);
            const assignedDrivers = drivers.filter((driver) =>
              assignedDriverIds.includes(driver.uid),
            );
            const assignedDriverNames = assignedDrivers
              .map((driver) => driver.fullName)
              .filter(Boolean);

            const sortedStops = [...(route.stops || [])].sort((a, b) => a.order - b.order);
            const stopsSequence = sortedStops.map((s) => s.stopName).filter(Boolean);

            return (
              <div
                key={route.routeId}
                className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <h3 className="text-lg font-bold text-[var(--text)]">
                      {route.routeName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                      {route.description || "No description provided"}
                    </p>
                  </div>
                  <div
                    className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${route.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                  />
                </div>

                <div className="mb-4 border-b border-[var(--border)] pb-4">
                  {assignedDrivers.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Assigned Drivers
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {assignedDrivers.map((driver) => (
                          <span
                            key={driver.uid}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1.5 text-sm font-medium text-[var(--text)]"
                          >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-[10px] font-semibold text-white">
                              {(driver.fullName || "").charAt(0).toUpperCase()}
                            </span>
                            {driver.fullName}
                          </span>
                        ))}
                      </div>
                      {assignedDriverNames.length > 0 ? (
                        <p className="text-xs text-[var(--text-secondary)]">
                          {assignedDriverNames.join(" • ")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      No Driver Assigned
                    </div>
                  )}
                </div>

                <div className="mb-4 space-y-3 border-b border-[var(--border)] pb-4">
                  {(route.departureTime || route.returnTime) ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Clock size={16} />
                      <span>
                        {route.departureTime && route.returnTime 
                          ? `Departure: ${formatTimeTo12Hour(route.departureTime)} | Return: ${formatTimeTo12Hour(route.returnTime)}`
                          : route.departureTime 
                            ? `Departure: ${formatTimeTo12Hour(route.departureTime)}`
                            : route.returnTime
                              ? `Return: ${formatTimeTo12Hour(route.returnTime)}`
                              : ""}
                      </span>
                    </div>
                  ) : null}

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



                  {stopsSequence.length > 0 && (
                    <div className="mt-4">
                      <div className="flex w-full items-center overflow-x-auto pb-4 pt-1 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="flex w-max min-w-full items-start px-1">
                          {stopsSequence.map((stopName, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === stopsSequence.length - 1;
                            
                            let dotColor = "bg-slate-300";
                            if (isFirst) dotColor = "bg-blue-500 ring-2 ring-blue-100";
                            if (isLast && stopsSequence.length > 1) dotColor = "bg-green-500 ring-2 ring-green-100";

                            return (
                              <div key={idx} className="flex flex-col items-center flex-1 min-w-[80px]">
                                <div className="flex items-center w-full">
                                  <div className="flex-1">
                                    {!isFirst && <div className="h-[2px] bg-[var(--border-strong)] w-full" />}
                                  </div>
                                  <div className={`h-2.5 w-2.5 rounded-full z-10 flex-shrink-0 ${dotColor}`} />
                                  <div className="flex-1">
                                    {!isLast && <div className="h-[2px] bg-[var(--border-strong)] w-full" />}
                                  </div>
                                </div>
                                <span className="mt-2 text-center text-[10px] font-medium leading-tight text-slate-500 px-1 max-w-[100px] line-clamp-2">
                                  {stopName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>

                <div className="mt-auto flex items-center justify-between pt-2">
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

                    <button
                      onClick={() => handleDeleteClick(route)}
                      className="rounded p-2 transition hover:bg-rose-50"
                      title="Delete route"
                    >
                      <Trash2
                        size={18}
                        className="text-rose-500 hover:text-rose-600"
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

      <ConfirmDialog
        open={!!deletingRoute}
        title="Delete Route?"
        message={`Are you sure you want to delete ${deletingRoute?.routeName}? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingRoute(null)}
      />

    </section>
  );
}
