"use client";

import Image from "next/image";
import { User, Route } from "@/types";
import { Eye, Pause } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface DriverTableProps {
  drivers: User[];
  routes: Route[];
  // eslint-disable-next-line no-unused-vars
  onViewDriver: (...args: [User]) => void;
  // eslint-disable-next-line no-unused-vars
  onSuspend: (...args: [User]) => void;
  // eslint-disable-next-line no-unused-vars
  onAssignRoute: (...args: [User]) => void;
}

function getVehicleIcon(vehicleType?: string): string {
  const icons: Record<string, string> = {
    van: "🚐",
    bus: "🚌",
    coaster: "🚎",
  };
  return icons[vehicleType || "van"] || "🚐";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function DriverTable({
  drivers,
  routes,
  onViewDriver,
  onSuspend,
  onAssignRoute,
}: DriverTableProps) {
  const getAssignedRouteName = (driverId: string): string => {
    const route = routes.find((r) => r.assignedDriverId === driverId);
    return route ? route.routeName : "Unassigned";
  };

  const getRatingStars = (rating?: number): string => {
    if (!rating) return "⭐ 0.0";
    return "⭐ " + rating.toFixed(1);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Email
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Phone
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Vehicle
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Capacity
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Assigned Route
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Rating
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Status
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver) => {
            const assignedRouteName = getAssignedRouteName(driver.uid);
            const hasRoute = assignedRouteName !== "Unassigned";

            return (
              <tr
                key={driver.uid}
                className="border-b border-slate-200 hover:bg-slate-50 transition"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {driver.profileImageUrl ? (
                      <Image
                        src={driver.profileImageUrl}
                        alt={driver.fullName}
                        width={32}
                        height={32}
                        unoptimized
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                        {getInitials(driver.fullName)}
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-900">
                      {driver.fullName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {driver.email}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {driver.phone}
                </td>
                <td className="px-4 py-3 text-sm text-slate-900">
                  <span className="mr-2">
                    {getVehicleIcon(driver.vehicleType)}
                  </span>
                  {driver.vehicleType
                    ? driver.vehicleType.charAt(0).toUpperCase() +
                      driver.vehicleType.slice(1)
                    : "N/A"}{" "}
                  ({driver.vehiclePlate || "N/A"})
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {driver.vehicleCapacity || "N/A"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={
                      assignedRouteName === "Unassigned"
                        ? "text-slate-400"
                        : "text-slate-900 font-medium"
                    }
                  >
                    {assignedRouteName}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-900">
                  {getRatingStars(driver.rating)}
                </td>
                <td className="px-4 py-3">
                  <Badge status={driver.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAssignRoute(driver)}
                      className="rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                      title={
                        hasRoute ? "Change route assignment" : "Assign route"
                      }
                    >
                      {hasRoute ? "Change Route" : "Assign Route"}
                    </button>
                    <button
                      onClick={() => onViewDriver(driver)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onSuspend(driver)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition"
                      title="Suspend driver"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
