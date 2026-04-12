"use client";

import { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { Route, User } from "@/types";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";

type AssignDriverModalProps = {
  open: boolean;
  onClose: () => void;
  route: Route;
  drivers: User[];
  currentDriver: User | null;
};

export default function AssignDriverModal({
  open,
  onClose,
  route,
  drivers,
  currentDriver,
}: AssignDriverModalProps) {
  const [selectedDriver, setSelectedDriver] = useState<User | null>(
    currentDriver || null,
  );
  const [isLoading, setIsLoading] = useState(false);

  // Filter to approved drivers only
  const approvedDrivers = useMemo(
    () => drivers.filter((d) => d.approved && d.status === "active"),
    [drivers],
  );

  const handleAssign = async () => {
    if (!selectedDriver) {
      toast.error("Please select a driver");
      return;
    }

    setIsLoading(true);
    try {
      // If there was a previous driver, remove the routeId from them
      if (currentDriver && currentDriver.uid !== selectedDriver.uid) {
        await updateDoc(doc(db, COLLECTIONS.USERS, currentDriver.uid), {
          routeId: "",
        });
      }

      // Update route with new driver
      await updateDoc(doc(db, COLLECTIONS.ROUTES, route.routeId), {
        assignedDriverId: selectedDriver.uid,
        assignedDriverName: selectedDriver.fullName,
      });

      // Update new driver with route
      await updateDoc(doc(db, COLLECTIONS.USERS, selectedDriver.uid), {
        routeId: route.routeId,
      });

      toast.success("Driver assigned successfully");
      onClose();
    } catch (error) {
      console.error("Error assigning driver:", error);
      toast.error("Failed to assign driver");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDriver = async () => {
    if (!currentDriver) return;

    setIsLoading(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.ROUTES, route.routeId), {
        assignedDriverId: "",
        assignedDriverName: "",
      });

      await updateDoc(doc(db, COLLECTIONS.USERS, currentDriver.uid), {
        routeId: "",
      });

      toast.success("Driver removed successfully");
      setSelectedDriver(null);
      onClose();
    } catch (error) {
      console.error("Error removing driver:", error);
      toast.error("Failed to remove driver");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Driver to Route"
      isLoading={isLoading}
    >
      <div className="space-y-6">
        {currentDriver && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <span className="font-semibold">Currently assigned:</span>{" "}
              {currentDriver.fullName}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Select Driver *
          </label>
          <select
            value={selectedDriver?.uid || ""}
            onChange={(e) => {
              const driver = approvedDrivers.find(
                (d) => d.uid === e.target.value,
              );
              setSelectedDriver(driver || null);
            }}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
          >
            <option value="">-- Choose a driver --</option>
            {approvedDrivers.map((driver) => (
              <option key={driver.uid} value={driver.uid}>
                {driver.fullName} • {driver.vehicleType} • {driver.phone}
              </option>
            ))}
          </select>
        </div>

        {approvedDrivers.length === 0 && (
          <div className="p-4 bg-amber-50 rounded-lg text-sm text-amber-700">
            No approved drivers available
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

          {currentDriver && (
            <button
              onClick={handleRemoveDriver}
              disabled={isLoading}
              className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg font-medium hover:bg-rose-50 transition disabled:opacity-50"
            >
              Remove Driver
            </button>
          )}

          <button
            onClick={handleAssign}
            disabled={
              isLoading ||
              !selectedDriver ||
              selectedDriver.uid === currentDriver?.uid
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Assigning..." : "Assign Driver"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
