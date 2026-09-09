"use client";

import Image from "next/image";
import { User, Route } from "@/types";
import { Calendar, MapPin, Pause, Play, Trash2, CheckCircle, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { formatTimeTo12Hour } from "@/utils/formatters";
import { formatDisplayPhone } from "@/lib/utils";

interface DriverDetailModalProps {
  open: boolean;
  driver: User;
  routes: Route[];
  onClose: () => void;
  onSuspend?: () => void;
  onDelete?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAssignedRoutes(
  driverId: string,
  routes: Route[],
): Route[] {
  return routes.filter((r) => r.assignedDriverId === driverId || (r.assignedDriverIds || []).includes(driverId));
}

function formatDate(date: any): string {
  if (!date) return "N/A";
  if (date.toDate) {
    return date.toDate().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return "N/A";
}

export default function DriverDetailModal({
  open,
  driver,
  routes,
  onClose,
  onSuspend,
  onDelete,
  onApprove,
  onReject,
}: DriverDetailModalProps) {
  const assignedRoutes = getAssignedRoutes(driver.uid, routes);
  const effectiveStatus = driver.status || ((driver as any).approved ? "active" : "pending");
  const isPending = effectiveStatus === "pending";
  const isSuspended = effectiveStatus === "suspended";
  const isApproved = effectiveStatus === "approved" || effectiveStatus === "active";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Driver Details"
      footer={
        <div className="flex gap-2 w-full">
          <button
            onClick={onDelete}
            className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 inline-flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          
          <div className="flex-1" />

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          
          {isPending && onApprove && onReject && (
            <>
              <button
                onClick={onReject}
                className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
              <button
                onClick={onApprove}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Approve Driver
              </button>
            </>
          )}

          {isSuspended && (
            <button
              onClick={onSuspend}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Reactivate Driver
            </button>
          )}

          {isApproved && (
            <button
              onClick={onSuspend}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Suspend Driver
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center pb-6 border-b border-slate-200">
          {driver.profileImageUrl ? (
            <Image
              src={driver.profileImageUrl}
              alt={driver.fullName}
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
              {getInitials(driver.fullName)}
            </div>
          )}

          <div className="flex-1">
            <h3 className="text-xl font-semibold text-slate-900">
              {driver.fullName}
            </h3>
            <p className="text-slate-600">{driver.email}</p>
            <p className="text-slate-600">{formatDisplayPhone(driver.phone || (driver as any).phoneNumber)}</p>
            <div className="mt-2">
              <Badge status={driver.status === "approved" ? "active" : driver.status} />
            </div>
          </div>
        </div>

        {/* Member Since */}
        <div>
          <p className="text-sm font-medium text-slate-600">Member Since</p>
          <p className="text-sm text-slate-900 mt-1">
            {formatDate(driver.createdAt)}
          </p>
        </div>

        {/* Identity Documents */}
        <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
          <h4 className="font-semibold text-slate-900 mb-3">
            Identity Documents
          </h4>
          {(!driver.cnic && !driver.cnicNumber && !driver.cnicFrontUrl && !driver.cnicBackUrl) ? (
            <p className="text-slate-500 text-sm text-center py-2">No CNIC documents uploaded</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-600">CNIC Number</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {driver.cnic || driver.cnicNumber || "N/A"}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                {driver.cnicFrontUrl && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Front</p>
                    <Image
                      src={driver.cnicFrontUrl}
                      alt="CNIC Front"
                      width={192}
                      height={128}
                      unoptimized
                      className="h-32 w-48 object-cover rounded-md border border-gray-200 bg-white"
                    />
                  </div>
                )}
                {driver.cnicBackUrl && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Back</p>
                    <Image
                      src={driver.cnicBackUrl}
                      alt="CNIC Back"
                      width={192}
                      height={128}
                      unoptimized
                      className="h-32 w-48 object-cover rounded-md border border-gray-200 bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Vehicle Info Card */}
        <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
          <h4 className="font-semibold text-slate-900 mb-3">
            Vehicle Information
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-600">Vehicle Type</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {driver.vehicleType
                  ? driver.vehicleType.charAt(0).toUpperCase() +
                    driver.vehicleType.slice(1)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Plate Number</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {driver.vehiclePlate || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Capacity</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {driver.vehicleCapacity || "N/A"} seats
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">CNIC</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {driver.cnic || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Route Cards */}
        {!isPending && assignedRoutes.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 mb-1">
              Assigned Routes ({assignedRoutes.length})
            </h4>
            {assignedRoutes.map((route) => (
              <div key={route.routeId} className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {route.routeName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-600">
                        {route.departureTime && `Departure: ${formatTimeTo12Hour(route.departureTime)}`}
                        {route.departureTime && route.returnTime && " | "}
                        {route.returnTime && `Return: ${formatTimeTo12Hour(route.returnTime)}`}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/dashboard/routes?routeId=${route.routeId}`}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-block mt-2"
                  >
                    View Route →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Performance Card */}
        {!isPending && (
          <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
            <h4 className="font-semibold text-slate-900 mb-3">Performance</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-lg">
                    {Array(Math.round(driver.rating || 0))
                      .fill(0)
                      .map(() => "⭐")
                      .join("")}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Rating: {driver.rating?.toFixed(1) || "0.0"}/5
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {driver.totalRides || 0}
                </p>
                <p className="text-xs text-slate-600">Total Rides Completed</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
