"use client";

import Image from "next/image";
import { User, Route } from "@/types";
import { Image as ImageIcon, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { formatDisplayPhone } from "@/lib/utils";

interface DriverCardProps {
  driver: User;
  routes: Route[];
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onVerifyCNIC?: () => void;
  // eslint-disable-next-line no-unused-vars
  onShowImage: (...args: [string]) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function DriverCard({
  driver,
  routes,
  onApprove,
  onReject,
  onDelete,
  onVerifyCNIC,
  onShowImage,
}: DriverCardProps) {
  const vehicleIcons: Record<string, string> = {
    van: "🚐",
    bus: "🚌",
    coaster: "🚎",
  };
  
  const effectiveStatus = driver.status || ((driver as any).approved ? "active" : "pending");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
      <div className="flex flex-col gap-6">
        {/* Header with avatar and basic info */}
        <div className="flex gap-4">
          {driver.profileImageUrl ? (
            <div className="relative">
              <Image
                src={driver.profileImageUrl}
                alt={driver.fullName}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-full object-cover"
              />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {getInitials(driver.fullName)}
            </div>
          )}

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {driver.fullName}
            </h3>
            <p className="text-sm text-slate-600">{driver.email}</p>
            <p className="text-sm text-slate-600">{formatDisplayPhone(driver.phone || (driver as any).phoneNumber)}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">CNIC</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              {driver.cnicNumber || driver.cnic || "N/A"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Vehicle Type</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              <span className="mr-1">
                {vehicleIcons[driver.vehicleType || "van"] || "🚐"}
              </span>
              {driver.vehicleType
                ? driver.vehicleType.charAt(0).toUpperCase() +
                  driver.vehicleType.slice(1)
                : "N/A"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Plate Number</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              {driver.vehiclePlate || "N/A"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Capacity</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              {driver.vehicleCapacity || "N/A"} seats
            </p>
          </div>
        </div>

        {/* Assigned Routes */}
        {effectiveStatus !== "pending" && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">Assigned Routes</p>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const assignedRouteNames = routes
                  .filter((r) => r.assignedDriverId === driver.uid || (r.assignedDriverIds || []).includes(driver.uid))
                  .map((r) => r.routeName);

                if (assignedRouteNames.length === 0) {
                  return <span className="text-sm text-slate-500">No routes assigned</span>;
                }

                return assignedRouteNames.map((name, idx) => (
                  <span key={idx} className="inline-block rounded-md bg-white border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-800 shadow-sm">
                    {name}
                  </span>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Profile photo and action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {driver.profileImageUrl && (
            <button
              onClick={() =>
                driver.profileImageUrl && onShowImage(driver.profileImageUrl)
              }
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition"
            >
              <ImageIcon className="h-4 w-4" />
              View Profile Photo
            </button>
          )}

          <div className="flex gap-3 flex-1">
            {onVerifyCNIC && (
              <button
                onClick={onVerifyCNIC}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition whitespace-nowrap"
              >
                Verify CNIC
              </button>
            )}
            <button
              onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
            >
              <CheckCircle className="h-4 w-4" />
              Approve Driver
            </button>
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-700 font-medium hover:bg-rose-50 transition"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
            <button
              onClick={onDelete}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-700 font-medium hover:bg-rose-50 transition"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
