"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import Link from "next/link";
import { Plus, Edit, Eye, Users, MapPin, Clock } from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { Route, User } from "@/types";
import { formatTimeTo12Hour } from "@/utils/formatters";
import { useAuth } from "@/context/AuthContext";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import AssignDriverModal from "@/components/routes/AssignDriverModal";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Routes Management</h1>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Route
        </button>
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
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="flex-1 text-lg font-bold text-slate-900">
                    {route.routeName}
                  </h3>
                  <div
                    className={`h-3 w-3 rounded-full ${route.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                  />
                </div>

                <div className="mb-4 border-b border-slate-200 pb-4">
                  {assignedDriver ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-semibold text-white">
                        {(assignedDriver.fullName || "")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {assignedDriver.fullName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {assignedDriver.vehicleType}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                      No Driver Assigned
                    </div>
                  )}
                </div>

                <div className="mb-4 space-y-3 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
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
                    <div className="text-sm font-medium text-slate-900">
                      PKR {route.feeAmount.toLocaleString("en-PK")}{" "}
                      <span className="text-xs text-slate-500">/month</span>
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
                    <span className="text-sm text-slate-600">
                      {route.isActive ? "Active" : "Inactive"}
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setAssigningRoute(route)}
                      className="rounded-md border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                    >
                      {route.assignedDriverId
                        ? "Change Driver"
                        : "Assign Driver"}
                    </button>

                    <Link
                      href={`/dashboard/routes/${route.routeId}`}
                      className="rounded p-2 transition hover:bg-slate-100"
                      title="View route details"
                    >
                      <Eye size={18} className="text-slate-600" />
                    </Link>

                    <button
                      onClick={() => handleEditClick(route)}
                      className="rounded p-2 transition hover:bg-slate-100"
                      title="Edit route"
                    >
                      <Edit size={18} className="text-slate-600" />
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
    </div>
  );
}
