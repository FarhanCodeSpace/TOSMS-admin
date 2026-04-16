"use client";

import { useState, useEffect } from "react";
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
import Badge from "@/components/ui/Badge";
import AssignDriverModal from "@/components/routes/AssignDriverModal";
import CreateRouteModal from "./CreateRouteModal";
import EditRouteModal from "./EditRouteModal";

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assigningRoute, setAssigningRoute] = useState<Route | null>(null);

  // Fetch routes
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.ROUTES),
      (snapshot) => {
        const routesList = snapshot.docs.map((doc) => ({
          ...doc.data(),
          routeId: doc.id,
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
  }, []);

  // Fetch drivers
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "driver")),
      (snapshot) => {
        const driversList = snapshot.docs.map((doc) => ({
          ...doc.data(),
          uid: doc.id,
        })) as User[];
        setDrivers(driversList);
      },
    );
    return () => unsubscribe();
  }, []);

  // Handle toggle active status
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
      {/* Header */}
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

      {/* Routes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {routes.map((route) => {
          const assignedDriver = drivers.find(
            (d) => d.uid === route.assignedDriverId,
          );
          return (
            <div
              key={route.routeId}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
            >
              {/* Route Name */}
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex-1">
                  {route.routeName}
                </h3>
                <div
                  className={`w-3 h-3 rounded-full ${route.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                />
              </div>

              {/* Driver Info */}
              <div className="mb-4 pb-4 border-b border-slate-200">
                {assignedDriver ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                      {(assignedDriver.fullName || "").charAt(0).toUpperCase()}
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

              {/* Times and Stats */}
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock size={16} />
                  <span>
                    {formatTimeTo12Hour(route.departureTime)} -{" "}
                    {formatTimeTo12Hour(route.returnTime)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Badge status="active">
                    <Users size={14} className="inline mr-1" />
                    {route.studentIds?.length || 0} students
                  </Badge>
                  <Badge status="active">
                    <MapPin size={14} className="inline mr-1" />
                    {route.stops?.length || 0} stops
                  </Badge>
                </div>
                {route.feeAmount && (
                  <div className="text-sm font-medium text-slate-900">
                    PKR {route.feeAmount.toLocaleString("en-PK")}{" "}
                    <span className="text-xs text-slate-500">/month</span>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={route.isActive}
                    onChange={() => handleToggleActive(route)}
                    className="w-4 h-4 rounded border-slate-300"
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
                    {route.assignedDriverId ? "Change Driver" : "Assign Driver"}
                  </button>
                  <Link
                    href={`/dashboard/routes/${route.routeId}`}
                    className="p-2 hover:bg-slate-100 rounded transition"
                    title="View route details"
                  >
                    <Eye size={18} className="text-slate-600" />
                  </Link>
                  <button
                    onClick={() => handleEditClick(route)}
                    className="p-2 hover:bg-slate-100 rounded transition"
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

      {routes.length === 0 && !isLoading && (
        <div className="py-12 text-center text-slate-500">
          <p>No routes created yet</p>
        </div>
      )}

      {/* Modals */}
      <CreateRouteModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
      {editingRoute && (
        <EditRouteModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          route={editingRoute}
        />
      )}
      {assigningRoute && (
        <AssignDriverModal
          open={!!assigningRoute}
          onClose={() => setAssigningRoute(null)}
          route={assigningRoute}
        />
      )}
    </div>
  );
}
