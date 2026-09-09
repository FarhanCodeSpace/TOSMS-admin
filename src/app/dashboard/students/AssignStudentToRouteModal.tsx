"use client";

import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { User, Route } from "@/types";
import { updateStudentRoutes } from "@/utils/firestoreHelpers";

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
  const initialAssignedRouteIds = useMemo(() => {
    return routes
      .filter((r) => r.studentIds?.includes(student.uid))
      .map((r) => r.routeId);
  }, [routes, student.uid]);

  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [selectedRouteStops, setSelectedRouteStops] = useState<Record<string, {pickupStop: string, dropStop: string}>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedRouteIds(initialAssignedRouteIds);
      
      const initialStops: Record<string, {pickupStop: string, dropStop: string}> = {};
      
      if (student.routeStops && Object.keys(student.routeStops).length > 0) {
         Object.assign(initialStops, student.routeStops);
      } else if (initialAssignedRouteIds.length > 0) {
         // Fallback for older data structure where only pickupStop existed
         const primaryRouteId = initialAssignedRouteIds[0];
         initialStops[primaryRouteId] = {
            pickupStop: student.pickupStop || "",
            dropStop: student.dropStop || ""
         };
      }
      
      setSelectedRouteStops(initialStops);
    }
  }, [open, initialAssignedRouteIds, student.routeStops, student.pickupStop, student.dropStop]);

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

  const handleToggleRoute = (routeId: string) => {
    setSelectedRouteIds((prev) =>
      prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId]
    );
  };

  const handleAssign = async () => {
    setIsLoading(true);
    try {
      const routesToAdd = selectedRouteIds.filter(
        (id) => !initialAssignedRouteIds.includes(id)
      );
      const routesToRemove = initialAssignedRouteIds.filter(
        (id) => !selectedRouteIds.includes(id)
      );

      const primaryRouteId = selectedRouteIds.length > 0 ? selectedRouteIds[0] : "";

      // Cleanup routeStops for unselected routes
      const finalRouteStops: Record<string, {pickupStop: string, dropStop: string}> = {};
      selectedRouteIds.forEach(id => {
        finalRouteStops[id] = selectedRouteStops[id] || { pickupStop: "", dropStop: "" };
      });

      await updateStudentRoutes(
        student.uid,
        routesToAdd,
        routesToRemove,
        primaryRouteId,
        finalRouteStops,
        selectedRouteIds
      );

      toast.success("Student routes updated successfully");
      onClose();
    } catch (error) {
      console.error("Error updating student routes:", error);
      toast.error("Failed to update student routes");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage Student Routes"
      isLoading={isLoading}
    >
      <div className="flex flex-col">
        <div className="space-y-6 pr-2 pb-4">
          {/* Current Routes Info */}
        {initialAssignedRouteIds.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700 font-semibold mb-2">
              Currently assigned to:
            </p>
            <ul className="list-disc pl-5 text-sm text-blue-800">
              {initialAssignedRouteIds.map((routeId) => {
                const route = routes.find((r) => r.routeId === routeId);
                return <li key={routeId}>{route?.routeName || "Unknown"}</li>;
              })}
            </ul>
          </div>
        )}

        {/* Route Selection (Checkboxes) */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Select Routes
          </label>
          <div className="max-h-56 overflow-y-auto pr-2 border border-slate-200 rounded-lg p-2 space-y-2">
            {availableRoutes.map((route) => (
              <label
                key={route.routeId}
                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={selectedRouteIds.includes(route.routeId)}
                  onChange={() => handleToggleRoute(route.routeId)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-900">
                    {route.routeName}
                  </span>
                  <span className="text-xs text-slate-500">
                    {route.studentIds?.length || 0}/30 students
                  </span>
                </div>
              </label>
            ))}
            {availableRoutes.length === 0 && (
              <div className="p-2 text-sm text-slate-500">
                No active routes available.
              </div>
            )}
          </div>
        </div>

        {/* Pickup/Drop Stop Selection per Route */}
        {selectedRouteIds.length > 0 && (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-900">
              Route Stops
            </label>
            {selectedRouteIds.map((routeId) => {
              const route = routes.find((r) => r.routeId === routeId);
              if (!route) return null;
              
              const stopsForRoute = route.stops?.slice().sort((a, b) => a.order - b.order) || [];
              const currentStops = selectedRouteStops[routeId] || { pickupStop: "", dropStop: "" };

              return (
                <div key={routeId} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <h4 className="font-medium text-slate-800 mb-3">{route.routeName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pickup Stop
                      </label>
                      <select
                        value={currentStops.pickupStop}
                        onChange={(e) => setSelectedRouteStops(prev => ({
                          ...prev,
                          [routeId]: { ...prev[routeId], pickupStop: e.target.value, dropStop: prev[routeId]?.dropStop || "" }
                        }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded outline-none focus:border-blue-500 text-sm"
                      >
                        <option value="">-- Choose pickup --</option>
                        {stopsForRoute.map((stop, index) => (
                          <option key={`pickup-${stop.stopName}-${index}`} value={stop.stopName}>
                            {stop.stopName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Drop Stop
                      </label>
                      <select
                        value={currentStops.dropStop}
                        onChange={(e) => setSelectedRouteStops(prev => ({
                          ...prev,
                          [routeId]: { ...prev[routeId], dropStop: e.target.value, pickupStop: prev[routeId]?.pickupStop || "" }
                        }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded outline-none focus:border-blue-500 text-sm"
                      >
                        <option value="">-- Choose drop --</option>
                        {stopsForRoute.map((stop, index) => (
                          <option key={`drop-${stop.stopName}-${index}`} value={stop.stopName}>
                            {stop.stopName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 mt-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
