"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { Search, Car } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { useAuth } from "@/context/AuthContext";
import { Route, User } from "@/types";

type AssignDriverModalProps = {
  open: boolean;
  onClose: () => void;
  route: Route;
  initialDriverId?: string;
};

type DriverWithCurrentRoute = User & {
  currentRouteName?: string;
};

export default function AssignDriverModal({
  open,
  onClose,
  route,
  initialDriverId,
}: AssignDriverModalProps) {
  const { currentUser, isLoading: authLoading } = useAuth();
  const [drivers, setDrivers] = useState<DriverWithCurrentRoute[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (authLoading) return;
    if (!currentUser) {
      toast.error("You must be logged in to assign drivers");
      return;
    }

    setSelectedDriverId(initialDriverId || route.assignedDriverId || "");
    setSearchTerm("");

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [routesSnap, driversSnap] = await Promise.all([
          getDocs(collection(db, COLLECTIONS.ROUTES)),
          getDocs(
            query(
              collection(db, COLLECTIONS.USERS),
              where("role", "==", "driver"),
              where("status", "==", "active"),
            ),
          ),
        ]);

        const routesMap = new Map<string, string>();
        routesSnap.docs.forEach((routeDoc) => {
          const data = routeDoc.data() as Partial<Route>;
          routesMap.set(
            routeDoc.id,
            data.routeName || data.name || "Unnamed Route",
          );
        });

        const mappedDrivers = driversSnap.docs.map((driverDoc) => {
          const driver = { ...driverDoc.data(), uid: driverDoc.id } as User;
          const currentRouteName = driver.routeId
            ? routesMap.get(driver.routeId) || "Unknown Route"
            : undefined;
          return {
            ...driver,
            currentRouteName,
          };
        });

        setDrivers(mappedDrivers);
      } catch (error) {
        console.error("Error loading drivers for assignment:", error);
        toast.error("Failed to load available drivers");
      } finally {
        setIsLoading(false);
      }
    };

    loadData().catch(() => undefined);
  }, [
    open,
    route.assignedDriverId,
    route.routeId,
    initialDriverId,
    authLoading,
    currentUser,
  ]);

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.uid === selectedDriverId) || null,
    [drivers, selectedDriverId],
  );

  const filteredDrivers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return drivers;

    return drivers.filter((driver) => {
      const candidate = [
        driver.fullName,
        driver.vehicleType,
        driver.vehiclePlate,
        driver.currentRouteName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return candidate.includes(term);
    });
  }, [drivers, searchTerm]);

  const warningRouteName =
    selectedDriver?.routeId && selectedDriver.routeId !== route.routeId
      ? selectedDriver.currentRouteName || "another route"
      : null;

  const handleAssignDriver = async () => {
    if (!selectedDriver) {
      toast.error("Please select a driver");
      return;
    }

    if (!currentUser) {
      toast.error("Authentication required to assign drivers");
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);

      const currentRouteRef = doc(db, COLLECTIONS.ROUTES, route.routeId);
      const selectedDriverRef = doc(db, COLLECTIONS.USERS, selectedDriver.uid);

      batch.update(currentRouteRef, {
        assignedDriverId: selectedDriver.uid,
        assignedDriverName: selectedDriver.fullName,
      });

      batch.update(selectedDriverRef, {
        routeId: route.routeId,
      });

      if (selectedDriver.routeId && selectedDriver.routeId !== route.routeId) {
        const previousRouteRef = doc(
          db,
          COLLECTIONS.ROUTES,
          selectedDriver.routeId,
        );
        batch.update(previousRouteRef, {
          assignedDriverId: "",
          assignedDriverName: "",
        });
      }

      const previousDriverId = route.assignedDriverId;
      if (previousDriverId && previousDriverId !== selectedDriver.uid) {
        const previousDriverRef = doc(db, COLLECTIONS.USERS, previousDriverId);
        batch.update(previousDriverRef, {
          routeId: "",
        });
      }

      await batch.commit();
      toast.success(
        "Driver assigned successfully! They will see this route in their mobile app.",
      );
      onClose();
    } catch (error: any) {
      console.error("Error assigning driver:", error);

      // Provide specific error messages
      if (error.code === "permission-denied") {
        toast.error(
          "Permission denied. Check Firestore rules allow admin writes to routes and drivers.",
        );
      } else if (error.message?.includes("insufficient permissions")) {
        toast.error(
          "Insufficient permissions. Admin user may not have write access.",
        );
      } else {
        toast.error(error.message || "Failed to assign driver");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign Driver to ${route.routeName}`}
      isLoading={isSubmitting}
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search drivers by name, vehicle, plate, or route..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {warningRouteName && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This driver is currently assigned to {warningRouteName}. Assigning
            here will remove them from that route.
          </div>
        )}

        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Loading drivers...
            </p>
          ) : filteredDrivers.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No drivers found
            </p>
          ) : (
            filteredDrivers.map((driver) => {
              const isSelected = selectedDriverId === driver.uid;
              const isAssignedElsewhere =
                !!driver.routeId && driver.routeId !== route.routeId;

              return (
                <button
                  key={driver.uid}
                  type="button"
                  onClick={() => setSelectedDriverId(driver.uid)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {driver.profileImageUrl ? (
                      <Image
                        src={driver.profileImageUrl}
                        alt={driver.fullName}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white">
                        {(driver.fullName || "?").charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {driver.fullName}
                        </p>
                        {isAssignedElsewhere ? (
                          <span className="text-xs text-slate-500">
                            ({driver.currentRouteName})
                          </span>
                        ) : !driver.routeId ? (
                          <Badge status="available">Available</Badge>
                        ) : (
                          <span className="text-xs text-slate-500">
                            ({driver.currentRouteName})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        <Car className="mr-1 inline h-3.5 w-3.5" />
                        {(driver.vehicleType || "N/A").toUpperCase()} •{" "}
                        {driver.vehiclePlate || "No plate"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssignDriver}
            disabled={isSubmitting || !selectedDriver}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Assigning..." : "Confirm Assignment"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
