"use client";

import { Clock3, Users, XCircle, UserMinus, HelpCircle, Zap, Bus } from "lucide-react";
import type { Ride } from "@/types";
import { formatTimeTo12Hour, getInitials } from "@/utils/formatters";
import { RideStatusBadge } from "@/components/ui/RideStatusBadge";

type ExtendedRideStatus = Ride["status"] | "waiting" | "accepted" | "expired" | "withdrawn" | "rejected";

type RideCardProps = {
  ride: Omit<Ride, "status"> & { status: ExtendedRideStatus };
  availableStudentsCount: number;
  notAvailableStudentsCount?: number;
  noResponseCount?: number;
  isEarlyRide?: boolean;
  studentsById?: Map<string, any> | Record<string, any>;
  onViewDetails: () => void;
  onCancelRide: () => void;
  onMarkCompleted: () => void;
};


export default function RideCard({
  ride,
  availableStudentsCount,
  notAvailableStudentsCount = 0,
  noResponseCount = 0,
  isEarlyRide,
  studentsById,
  onViewDetails,
  onCancelRide,
  onMarkCompleted,
}: RideCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">{ride.routeName}</h3>
            {isEarlyRide ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Zap fill="currentColor" size={12} />
                Early Ride
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {ride.departureTime && ride.returnTime
              ? `Dep: ${formatTimeTo12Hour(ride.departureTime)} • Ret: ${formatTimeTo12Hour(ride.returnTime)}`
              : ride.departureTime
              ? `Departure: ${formatTimeTo12Hour(ride.departureTime)}`
              : ride.returnTime
              ? `Return: ${formatTimeTo12Hour(ride.returnTime)}`
              : "Time TBD"}
          </p>
        </div>
        <RideStatusBadge status={isEarlyRide && (ride.status === 'scheduled' || ride.status === 'accepted') ? 'accepted' : ride.status} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-blue-700">
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
            {getInitials(ride.driverName || "Driver")}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {ride.driverName || "Unassigned Driver"}
          </p>
          <p className="text-xs text-slate-500">Assigned driver</p>
        </div>
      </div>

      {isEarlyRide ? (() => {
          const allStudentsById = (studentsById instanceof Map) ? Object.fromEntries(studentsById.entries()) : (studentsById || {});
          
          let calculatedMales = 0;
          let calculatedFemales = 0;
          const studentsList = Array.isArray((ride as any).studentsJoined) ? (ride as any).studentsJoined : [];

          studentsList.forEach((s: any) => {
            const studentId = typeof s === 'string' ? s : (s.id || s.studentId);
            // Use the globally fetched dictionary here!
            const profile = allStudentsById?.[studentId] || s; 
            const gender = (profile as any)?.gender?.toLowerCase();

            if (gender === 'male') calculatedMales++;
            if (gender === 'female') calculatedFemales++;
          });

          const males = (ride as any).maleCount ?? calculatedMales;
          const females = (ride as any).femaleCount ?? calculatedFemales;
          const total = (ride as any).totalStudents ?? (studentsList.length > 0 ? studentsList.length : Math.max(1, males + females));

          return (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4 text-emerald-500" />
                Students: {total} (👦 {males} 👧 {females})
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                <Bus className="h-4 w-4 text-blue-500" />
                Vehicle: {(ride as any).vehicleType || (ride as any).vehicle?.name || "TBD"} - {(ride as any).vehiclePlate || (ride as any).vehicle?.plateNumber || "TBD"}
              </div>
            </div>
          );
      })() : (
        <div className="mt-4 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 px-2 py-2">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Available</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4 text-emerald-500" />
                {availableStudentsCount}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2 py-2">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Not Avail.</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <UserMinus className="h-4 w-4 text-rose-500" />
                {notAvailableStudentsCount}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2 py-2">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">No Resp.</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <HelpCircle className="h-4 w-4 text-slate-400" />
                {noResponseCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
            <Bus className="h-4 w-4 text-blue-500" />
            Vehicle: {(ride as any).vehicleType || "TBD"} - {(ride as any).vehiclePlate || "TBD"}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onViewDetails}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View Details
        </button>
        {(ride.status === "scheduled" || ride.status === "waiting") && (
          <button
            type="button"
            onClick={onCancelRide}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel Ride
          </button>
        )}
        {(ride.status === "active") && (
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onMarkCompleted}
              className="text-sm bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition"
            >
              Mark Completed
            </button>
            <button
              type="button"
              onClick={onCancelRide}
              className="text-sm border border-red-500 text-red-500 px-3 py-1 rounded-md hover:bg-red-50 transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
