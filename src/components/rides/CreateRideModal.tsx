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

import Modal from "@/components/ui/Modal";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Route } from "@/types";
import { getTodayString } from "@/utils/dateHelpers";

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
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [routeId, setRouteId] = useState("");
  const [rideDate, setRideDate] = useState(getTodayString());
  const [departureTime, setDepartureTime] = useState("");

  useEffect(() => {
    if (!open) return;

    const loadRoutes = async () => {
      setLoadingRoutes(true);
      try {
        const routesSnap = await getDocs(
          query(
            collection(db, COLLECTIONS.ROUTES),
            where("isActive", "==", true),
          ),
        );

        const activeRoutes = routesSnap.docs.map((routeDoc) => ({
          ...(routeDoc.data() as Route),
          routeId: routeDoc.id,
        }));

        setRoutes(activeRoutes);

        if (activeRoutes.length > 0) {
          setRouteId(activeRoutes[0].routeId);
          setDepartureTime(activeRoutes[0].departureTime || "08:00");
        } else {
          setRouteId("");
          setDepartureTime("");
        }
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

  useEffect(() => {
    if (!selectedRoute) return;
    setDepartureTime(selectedRoute.departureTime || "08:00");
  }, [selectedRoute?.routeId]);

  const handleCreateRide = async () => {
    if (!selectedRoute) {
      toast.error("Please select a route");
      return;
    }

    if (!rideDate || !departureTime) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const rideRef = doc(collection(db, COLLECTIONS.RIDES));

      await setDoc(rideRef, {
        rideId: rideRef.id,
        routeId: selectedRoute.routeId,
        routeName: selectedRoute.routeName || "Unnamed Route",
        assignedDriverId: selectedRoute.assignedDriverId || "",
        driverName: selectedRoute.assignedDriverName || "Unassigned Driver",
        date: rideDate,
        departureTime,
        status: "scheduled",
        boardedCount: 0,
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
            {routes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.routeName} - {route.assignedDriverName || "No Driver"} -{" "}
                {route.studentIds?.length || 0} students
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
            Driver Name
          </label>
          <input
            type="text"
            value={selectedRoute?.assignedDriverName || "Unassigned Driver"}
            readOnly
            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
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
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Departure Time
            </label>
            <input
              type="time"
              value={departureTime}
              onChange={(event) => setDepartureTime(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
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
            onClick={handleCreateRide}
            disabled={isSubmitting || !selectedRoute}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Ride"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
