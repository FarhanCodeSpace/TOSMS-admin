"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { Clock, MapPin, Users } from "lucide-react";

import Modal from "@/components/ui/Modal";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Route } from "@/types";
import { getTodayString } from "@/utils/dateHelpers";
import { formatTimeTo12Hour } from "@/utils/formatters";
import { getRouteAssignedDriverIds } from "@/utils/routeAssignments";

type CreateRideModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreateRideModal({
  open,
  onClose,
  onCreated,
}: CreateRideModalProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<{uid: string, fullName: string}[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [routeId, setRouteId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [rideDate, setRideDate] = useState(getTodayString());

  useEffect(() => {
    if (!open) return;

    const loadRoutes = async () => {
      setLoadingRoutes(true);
      try {
        const [routesSnap, driversSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, COLLECTIONS.ROUTES),
              where("isActive", "==", true),
            ),
          ),
          getDocs(
            query(
              collection(db, COLLECTIONS.USERS),
              where("role", "==", "driver"),
              where("status", "in", ["active", "approved"])
            )
          )
        ]);

        const activeRoutes = routesSnap.docs.map((routeDoc) => ({
          ...(routeDoc.data() as Route),
          routeId: routeDoc.id,
        }));

        const activeDrivers = driversSnap.docs.map(doc => ({
          uid: doc.id,
          fullName: doc.data().fullName || "Unknown Driver"
        }));

        setRoutes(activeRoutes);
        setDrivers(activeDrivers);
        setRouteId("");
      } catch (error) {
        console.error("Error loading routes:", error);
        toast.error("Failed to load active routes");
      } finally {
        setLoadingRoutes(false);
      }
    };

    setRideDate(getTodayString());
    void loadRoutes();
  }, [open]);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.routeId === routeId) || null,
    [routes, routeId],
  );

  const availableDrivers = useMemo(() => {
    if (!selectedRoute) return [];
    const assignedIds = getRouteAssignedDriverIds(selectedRoute);
    if (selectedRoute.assignedDriverId && !assignedIds.includes(selectedRoute.assignedDriverId)) {
      assignedIds.push(selectedRoute.assignedDriverId);
    }
    if ((selectedRoute as any).driverId && !assignedIds.includes((selectedRoute as any).driverId)) {
      assignedIds.push((selectedRoute as any).driverId);
    }
    
    if (assignedIds.length > 0) {
      return drivers.filter(d => assignedIds.includes(d.uid));
    }
    return [];
  }, [selectedRoute, drivers]);

  useEffect(() => {
    if (selectedRoute && availableDrivers.length > 0) {
      if (availableDrivers.length === 1) {
        setSelectedDriverId(availableDrivers[0].uid);
      } else {
        setSelectedDriverId((prev) => availableDrivers.some(d => d.uid === prev) ? prev : "");
      }
    } else {
      setSelectedDriverId("");
    }
  }, [selectedRoute, availableDrivers]);

  const handleCreateRide = async () => {
    if (!selectedRoute) {
      toast.error("Please select a route");
      return;
    }

    if (!rideDate) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!selectedDriverId) {
      toast.error("Please select a driver for this ride");
      return;
    }

    const driverName = drivers.find(d => d.uid === selectedDriverId)?.fullName || "Unassigned Driver";

    setIsSubmitting(true);
    try {
      const rideRef = doc(collection(db, COLLECTIONS.RIDES));

      await setDoc(rideRef, {
        rideId: rideRef.id,
        routeId: selectedRoute.routeId,
        routeName: selectedRoute.routeName || "Unnamed Route",
        driverId: selectedDriverId,
        assignedDriverId: selectedDriverId,
        driverName: driverName,
        date: rideDate,
        departureTime: selectedRoute.departureTime || "",
        returnTime: selectedRoute.returnTime || "",
        status: "scheduled",
        boardedCount: 0,
        studentIds: selectedRoute.studentIds || [],
        createdAt: serverTimestamp(),
        scheduledAt: serverTimestamp(),
      });

      toast.success("Ride created! Driver will see it in their app.");
      onCreated?.();
      onClose();
    } catch (error) {
      console.error("Error creating ride:", error);
      toast.error("Failed to create ride");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Ride"
      isLoading={isSubmitting}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Route</label>
          <select
            value={routeId}
            onChange={(event) => setRouteId(event.target.value)}
            disabled={loadingRoutes || isSubmitting || routes.length === 0}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
          >
            <option value="" disabled>
              Select a route...
            </option>
            {routes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.routeName}
              </option>
            ))}
          </select>
          {routes.length === 0 && !loadingRoutes ? (
            <p className="text-xs text-amber-700">
              No active routes available.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">
            Assigned Driver for this Ride
          </label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            disabled={isSubmitting || availableDrivers.length === 0 || !selectedRoute}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
          >
            {!selectedRoute ? (
              <option value="" disabled>Select a route first</option>
            ) : availableDrivers.length === 0 ? (
              <option value="" disabled>No driver assigned to this route</option>
            ) : (
              <>
                {availableDrivers.length > 1 && (
                  <option value="" disabled>Select a driver</option>
                )}
                {availableDrivers.map((driver) => (
                  <option key={driver.uid} value={driver.uid}>
                    {driver.fullName}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Ride Date
            </label>
            <input
              type="date"
              value={rideDate}
              onChange={(event) => setRideDate(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {selectedRoute && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
              Route Details
            </h3>
            
            <div className="space-y-3">
              {(selectedRoute.departureTime || selectedRoute.returnTime) && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock size={16} />
                  <span>
                    {selectedRoute.departureTime && selectedRoute.returnTime 
                      ? `Departure: ${formatTimeTo12Hour(selectedRoute.departureTime)} | Return: ${formatTimeTo12Hour(selectedRoute.returnTime)}`
                      : selectedRoute.departureTime 
                        ? `Departure: ${formatTimeTo12Hour(selectedRoute.departureTime)}`
                        : selectedRoute.returnTime
                          ? `Return: ${formatTimeTo12Hour(selectedRoute.returnTime)}`
                          : ""}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Users size={16} />
                  <span>{selectedRoute.studentIds?.length || 0} Total Students</span>
                </div>
              </div>

              {selectedRoute.stops && selectedRoute.stops.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Stops Sequence</p>
                  <div className="flex w-full items-center overflow-x-auto pb-2 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <div className="flex w-max min-w-full items-start px-1">
                      {(() => {
                        const sortedStops = [...selectedRoute.stops].sort((a, b) => a.order - b.order);
                        const stopsSequence = sortedStops.map(s => s.stopName).filter(Boolean);
                        
                        return stopsSequence.map((stopName, idx) => {
                          const isFirst = idx === 0;
                          const isLast = idx === stopsSequence.length - 1;
                          
                          let dotColor = "bg-slate-300";
                          if (isFirst) dotColor = "bg-blue-500 ring-2 ring-blue-100";
                          if (isLast && stopsSequence.length > 1) dotColor = "bg-green-500 ring-2 ring-green-100";

                          return (
                            <div key={idx} className="flex flex-col items-center flex-1 min-w-[60px]">
                              <div className="flex items-center w-full">
                                <div className="flex-1">
                                  {!isFirst && <div className="h-[2px] bg-slate-200 w-full" />}
                                </div>
                                <div className={`h-2 w-2 rounded-full z-10 flex-shrink-0 ${dotColor}`} />
                                <div className="flex-1">
                                  {!isLast && <div className="h-[2px] bg-slate-200 w-full" />}
                                </div>
                              </div>
                              <span className="mt-1 text-center text-[9px] font-medium leading-tight text-slate-500 px-1 max-w-[80px] line-clamp-2">
                                {stopName}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
            onClick={handleCreateRide}
            disabled={isSubmitting || !selectedRoute || !selectedDriverId}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Ride"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
