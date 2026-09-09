"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import toast from "react-hot-toast";

import Modal from "@/components/ui/Modal";
import { updateDriverRoutes } from "@/utils/firestoreHelpers";
import { Route, User } from "@/types";

type AssignDriverRoutesModalProps = {
  open: boolean;
  onClose: () => void;
  driver: User;
  routes: Route[];
  onSuccess?: () => void;
};

export default function AssignDriverRoutesModal({
  open,
  onClose,
  driver,
  routes,
  onSuccess,
}: AssignDriverRoutesModalProps) {
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    let initialRoutes: string[] = [];
    if (driver.assignedRouteIds && driver.assignedRouteIds.length > 0) {
      initialRoutes = driver.assignedRouteIds;
    } else if (driver.routeId) {
      initialRoutes = [driver.routeId];
    }
    setSelectedRouteIds(new Set(initialRoutes));
    setSearchTerm("");
  }, [open, driver]);

  const filteredRoutes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const activeRoutes = routes.filter((r) => r.isActive);
    if (!term) return activeRoutes;
    return activeRoutes.filter((route) =>
      route.routeName?.toLowerCase().includes(term)
    );
  }, [routes, searchTerm]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      let initialRoutes: string[] = [];
      if (driver.assignedRouteIds && driver.assignedRouteIds.length > 0) {
        initialRoutes = driver.assignedRouteIds;
      } else if (driver.routeId) {
        initialRoutes = [driver.routeId];
      }

      const initialSet = new Set(initialRoutes);
      const finalSet = selectedRouteIds;

      const routeIdsToAdd = Array.from(finalSet).filter((id) => !initialSet.has(id));
      const routeIdsToRemove = Array.from(initialSet).filter((id) => !finalSet.has(id));
      
      const finalRouteIds = Array.from(finalSet);
      const primaryRouteId = finalRouteIds.length > 0 ? finalRouteIds[0] : "";

      await updateDriverRoutes(
        driver.uid,
        driver.fullName || "",
        routeIdsToAdd,
        routeIdsToRemove,
        primaryRouteId,
        finalRouteIds
      );

      toast.success("Routes updated successfully!");
      
      // Allow firestore sync
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onClose();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error updating routes:", error);
      toast.error(error.message || "Failed to update routes");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign Routes to ${driver.fullName}`}
      isLoading={isSubmitting}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Assignments"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search routes..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2">
          {filteredRoutes.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No routes found
            </p>
          ) : (
            filteredRoutes.map((route) => {
              const isSelected = selectedRouteIds.has(route.routeId);

              return (
                <button
                  key={route.routeId}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedRouteIds);
                    if (next.has(route.routeId)) next.delete(route.routeId);
                    else next.add(route.routeId);
                    setSelectedRouteIds(next);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900">
                      {route.routeName}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      {route.stops?.length || 0} stops • {route.studentIds?.length || 0} students
                    </span>
                  </div>
                  <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                    isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"
                  }`}>
                    {isSelected && (
                      <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
