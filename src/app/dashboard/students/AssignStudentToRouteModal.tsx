"use client";

import { useState, useMemo } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { User, Route } from "@/types";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";

type AssignStudentToRouteModalProps = {
  open: boolean;
  onClose: () => void;
  student: User;
  routes: Route[];
};

export default function AssignStudentToRouteModal({
  open,
  onClose,
  student,
  routes,
}: AssignStudentToRouteModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedPickupStop, setSelectedPickupStop] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Get active routes with available capacity
  const availableRoutes = useMemo(() => {
    return routes
      .filter((r) => r.isActive)
      .map((r) => ({
        ...r,
        availableCapacity:
          (r.stops?.[0]?.coordinates?.latitude ? 30 : 30) -
          (r.studentIds?.length || 0), // Assuming 30 capacity per route
      }));
  }, [routes]);

  const handleAssign = async () => {
    if (!selectedRoute || !selectedPickupStop) {
      toast.error("Please select a route and pickup stop");
      return;
    }

    setIsLoading(true);
    try {
      // If student already has a route, remove them first
      if (student.routeId) {
        await updateDoc(doc(db, COLLECTIONS.ROUTES, student.routeId), {
          studentIds: arrayRemove(student.uid),
        });
      }

      // Add student to new route
      await updateDoc(doc(db, COLLECTIONS.ROUTES, selectedRoute.routeId), {
        studentIds: arrayUnion(student.uid),
      });

      // Update student document
      await updateDoc(doc(db, COLLECTIONS.USERS, student.uid), {
        routeId: selectedRoute.routeId,
        pickupStop: selectedPickupStop,
      });

      toast.success(
        student.routeId
          ? "Student reassigned successfully"
          : "Student assigned successfully",
      );
      onClose();
    } catch (error) {
      console.error("Error assigning student:", error);
      toast.error("Failed to assign student");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        student.routeId
          ? "Reassign Student to Route"
          : "Assign Student to Route"
      }
      isLoading={isLoading}
    >
      <div className="space-y-6">
        {/* Current Route Info */}
        {student.routeId && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <span className="font-semibold">Currently assigned to:</span>{" "}
              {routes.find((r) => r.routeId === student.routeId)?.routeName ||
                "Unknown"}
            </p>
          </div>
        )}

        {/* Route Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Select Route *
          </label>
          <select
            value={selectedRoute?.routeId || ""}
            onChange={(e) => {
              const route = availableRoutes.find(
                (r) => r.routeId === e.target.value,
              );
              setSelectedRoute(route || null);
              setSelectedPickupStop("");
            }}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
          >
            <option value="">-- Choose a route --</option>
            {availableRoutes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.routeName} ({route.studentIds?.length || 0}/30 students)
              </option>
            ))}
          </select>
        </div>

        {/* Pickup Stop Selection */}
        {selectedRoute && (
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Select Pickup Stop *
            </label>
            <select
              value={selectedPickupStop}
              onChange={(e) => setSelectedPickupStop(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            >
              <option value="">-- Choose a pickup stop --</option>
              {selectedRoute.stops?.map((stop) => (
                <option key={stop.order} value={stop.stopName}>
                  {stop.order}. {stop.stopName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={isLoading || !selectedRoute || !selectedPickupStop}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "Assigning..."
              : student.routeId
                ? "Reassign"
                : "Assign"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
