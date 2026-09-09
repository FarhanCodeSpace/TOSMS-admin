"use client";

import Image from "next/image";
import { User, Route } from "@/types";
import { Eye, Pause, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatDisplayPhone } from "@/lib/utils";

interface DriverTableProps {
  drivers: User[];
  routes: Route[];
  dailyAverages?: Record<string, number>;
  // eslint-disable-next-line no-unused-vars
  onViewDriver: (...args: [User]) => void;
  // eslint-disable-next-line no-unused-vars
  onSuspend: (...args: [User]) => void;
  // eslint-disable-next-line no-unused-vars
  onAssignRoute: (...args: [User]) => void;
  // eslint-disable-next-line no-unused-vars
  onDelete: (...args: [User]) => void;
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

import { getRouteAssignedDriverIds } from "@/utils/routeAssignments";

export default function DriverTable({
  drivers,
  routes,
  dailyAverages,
  onViewDriver,
  onSuspend,
  onAssignRoute,
  onDelete,
}: DriverTableProps) {
  const getAssignedRouteNames = (driverId: string): string[] => {
    return routes
      .filter((r) => getRouteAssignedDriverIds(r).includes(driverId))
      .map((r) => r.routeName);
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
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[220px]">
              Driver
            </th>
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[250px]">
              Email
            </th>
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[150px]">
              Phone
            </th>
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[160px]">
              CNIC
            </th>
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[180px]">
              Vehicle
            </th>
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[120px]">
              Capacity
            </th>
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[180px]">
              Assigned Routes
            </th>
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[120px]">
              Rating
            </th>
            <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900 min-w-[120px]">
              Status
            </th>
            <th className="px-6 py-3.5 text-center text-sm font-semibold text-slate-900 min-w-[180px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {drivers.map((driver) => {
            const assignedRouteNames = getAssignedRouteNames(driver.uid);
            const hasRoute = assignedRouteNames.length > 0;

            return (
              <tr
                key={driver.uid}
                className="hover:bg-slate-50 transition"
              >
                <td className="px-6 py-4 whitespace-nowrap min-w-[220px]">
                  <div className="flex items-center gap-3">
                    {driver.profileImageUrl ? (
                      <Image
                        src={driver.profileImageUrl}
                        alt={driver.fullName || ""}
                        width={32}
                        height={32}
                        unoptimized
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                        {getInitials(driver.fullName || "")}
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-900">
                      {driver.fullName}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[250px]">
                  {driver.email}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[150px]">
                  {formatDisplayPhone(driver.phone || (driver as any).phoneNumber)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[160px]">
                  {driver.cnicNumber || driver.cnic || (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-900 whitespace-nowrap min-w-[180px]">
                  <span className="mr-2">
                    {getVehicleIcon(driver.vehicleType)}
                  </span>
                  {driver.vehicleType
                    ? driver.vehicleType.charAt(0).toUpperCase() +
                      driver.vehicleType.slice(1)
                    : "N/A"}{" "}
                  ({driver.vehiclePlate || "N/A"})
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[120px]">
                  {driver.vehicleCapacity || "N/A"}
                </td>
                <td className="px-6 py-4 text-sm min-w-[180px]">
                  <div className="flex flex-wrap gap-1">
                    {hasRoute ? (
                      assignedRouteNames.map((name, idx) => (
                        <span key={idx} className="inline-block rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 whitespace-nowrap">
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 whitespace-nowrap">No Route Assigned</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-900 whitespace-nowrap min-w-[120px]">
                  {getRatingStars(dailyAverages?.[driver.uid] || 0.0)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                  <Badge status={driver.status === "approved" ? "active" : driver.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap min-w-[180px]">
                  <div className="flex items-center justify-center gap-2">
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
                    <button
                      onClick={() => onDelete(driver)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition"
                      title="Delete driver"
                    >
                      <Trash2 className="h-4 w-4" />
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
