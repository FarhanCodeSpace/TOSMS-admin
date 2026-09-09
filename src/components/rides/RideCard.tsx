"use client";

import { Clock3, Users, XCircle, UserMinus, HelpCircle, Zap } from "lucide-react";
import type { Ride } from "@/types";
import { formatTimeTo12Hour, getInitials } from "@/utils/formatters";

type RideCardProps = {
  ride: Ride;
  availableStudentsCount: number;
  notAvailableStudentsCount?: number;
  noResponseCount?: number;
  isEarlyRide?: boolean;
  onViewDetails: () => void;
  onCancelRide: () => void;
  onMarkCompleted: () => void;
};

function StatusBadge({ status }: { status: Ride["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    );
  }

  if (status === "scheduled") {
    return (
      <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
        Scheduled
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        Completed
      </span>
    );
  }

  if (status === "auto_cancelled" || status === "cancelled" || (status as string) === "not_completed") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Cancelled
      </span>
    );
  }

  const defaultText = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

  return (
    <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
      {defaultText}
    </span>
  );
}

export default function RideCard({
  ride,
  availableStudentsCount,
  notAvailableStudentsCount = 0,
  noResponseCount = 0,
  isEarlyRide,
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
            Departure: {formatTimeTo12Hour(ride.departureTime)}
          </p>
        </div>
        <StatusBadge status={ride.status} />
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

      <div className="mt-4 grid grid-cols-3 gap-2">
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onViewDetails}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View Details
        </button>
        {ride.status === "scheduled" ? (
          <button
            type="button"
            onClick={onCancelRide}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel Ride
          </button>
        ) : null}
        {ride.status === "active" ? (
          <button
            type="button"
            onClick={onMarkCompleted}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <Clock3 className="h-3.5 w-3.5" />
            Mark Completed
          </button>
        ) : null}
      </div>
    </article>
  );
}
