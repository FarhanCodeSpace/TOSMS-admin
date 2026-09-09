"use client";

import { useMemo, useState, useEffect } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import toast from "react-hot-toast";

import Modal from "@/components/ui/Modal";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Route } from "@/types";
import { formatTimeTo12Hour } from "@/utils/formatters";
import { getRouteAssignedDriverIds } from "@/utils/routeAssignments";

type Driver = { uid: string; fullName: string };

type DailyDispatchModalProps = {
  open: boolean;
  onClose: () => void;
  routesToCreate: Route[];
  driversList: Driver[];
  todayString: string;
};

export default function DailyDispatchModal({
  open,
  onClose,
  routesToCreate,
  driversList,
  todayString,
}: DailyDispatchModalProps) {
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const initialSelection: Record<string, string> = {};
      const allIds: string[] = [];
      
      routesToCreate.forEach((route) => {
        allIds.push(route.routeId);
        
        const assignedIds = getRouteAssignedDriverIds(route);
        const routeDrivers = driversList.filter((d) => assignedIds.includes(d.uid));
        
        if (routeDrivers.length === 1) {
          initialSelection[route.routeId] = routeDrivers[0].uid;
        } else {
          initialSelection[route.routeId] = "";
        }
      });
      setSelectedDrivers(initialSelection);
      setSelectedRouteIds(allIds);
    }
  }, [open, routesToCreate, driversList]);

  const isValid = useMemo(() => {
    if (selectedRouteIds.length === 0) return false;
    return selectedRouteIds.every((routeId) => {
      const val = selectedDrivers[routeId];
      return val && val !== "";
    });
  }, [selectedRouteIds, selectedDrivers]);

  const handleDispatch = async () => {
    if (!isValid) return;
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      const routesToDispatch = routesToCreate.filter((route) => selectedRouteIds.includes(route.routeId));

      routesToDispatch.forEach((route) => {
        const assignedDriverId = selectedDrivers[route.routeId];
        const driverName = driversList.find((d) => d.uid === assignedDriverId)?.fullName || "Unassigned Driver";

        const rideRef = doc(collection(db, COLLECTIONS.RIDES));
        batch.set(rideRef, {
          rideId: rideRef.id,
          routeId: route.routeId,
          routeName: route.routeName || "Unnamed Route",
          assignedDriverId: assignedDriverId,
          driverId: assignedDriverId,
          driverName: driverName,
          date: todayString,
          departureTime: route.departureTime || "",
          returnTime: route.returnTime || "",
          status: "scheduled",
          boardedCount: 0,
          studentIds: route.studentIds || [],
          createdAt: serverTimestamp(),
          scheduledAt: serverTimestamp(),
        });
      });

      await batch.commit();
      toast.success(`Successfully dispatched ${routesToDispatch.length} rides for today`);
      onClose();
    } catch (error) {
      console.error("Error dispatching daily rides:", error);
      toast.error("Failed to dispatch rides");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Daily Dispatch"
      isLoading={isSubmitting}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Review and assign drivers for today's rides. Routes with exactly one driver have been pre-selected.
        </p>

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Routes to Dispatch</p>
          <button
            type="button"
            disabled={isSubmitting || routesToCreate.length === 0}
            onClick={() => {
              setSelectedRouteIds(
                selectedRouteIds.length === routesToCreate.length
                  ? []
                  : routesToCreate.map((r) => r.routeId)
              );
            }}
            className="text-xs font-semibold text-blue-700"
          >
            {selectedRouteIds.length === routesToCreate.length ? "Unselect All" : "Select All"}
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
          {routesToCreate.map((route) => {
            const assignedIds = getRouteAssignedDriverIds(route);
            const routeDrivers = driversList.filter((d) => assignedIds.includes(d.uid));
            const isSelected = selectedRouteIds.includes(route.routeId);

            return (
              <div
                key={route.routeId}
                className={`rounded-xl border border-slate-200 p-4 transition-colors ${isSelected ? "bg-slate-50" : "bg-white opacity-60"}`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedRouteIds((prev) =>
                          prev.includes(route.routeId)
                            ? prev.filter((id) => id !== route.routeId)
                            : [...prev, route.routeId]
                        );
                      }}
                      disabled={isSubmitting}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-slate-800">
                        {route.routeName}
                      </span>
                      {(route.departureTime || route.returnTime) && (
                        <span className="inline-block w-max rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {route.departureTime && route.returnTime
                            ? `${formatTimeTo12Hour(route.departureTime)} - ${formatTimeTo12Hour(route.returnTime)}`
                            : route.departureTime
                              ? `Departs: ${formatTimeTo12Hour(route.departureTime)}`
                              : `Returns: ${formatTimeTo12Hour(route.returnTime)}`}
                        </span>
                      )}
                    </div>
                  </label>

                  <div className="w-full md:w-48 shrink-0">
                    <select
                      value={selectedDrivers[route.routeId] || ""}
                      onChange={(e) =>
                        setSelectedDrivers((prev) => ({
                          ...prev,
                          [route.routeId]: e.target.value,
                        }))
                      }
                      disabled={isSubmitting || routeDrivers.length === 0 || !isSelected}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>
                        Select Driver...
                      </option>
                      {routeDrivers.map((driver) => (
                        <option key={driver.uid} value={driver.uid}>
                          {driver.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDispatch}
            disabled={isSubmitting || !isValid}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Dispatching..." : "Confirm Dispatch"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
