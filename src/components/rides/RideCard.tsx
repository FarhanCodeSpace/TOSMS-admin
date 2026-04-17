"use client";

import { CheckCircle2, Clock3, Users, XCircle } from "lucide-react";
import type { Ride } from "@/types";
import { formatTimeTo12Hour, getInitials } from "@/utils/formatters";

type RideCardProps = {
  ride: Ride;
  availableStudentsCount: number;
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
      <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
        Completed
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
      Cancelled
    </span>
  );
}

export default function RideCard({
  ride,
  availableStudentsCount,
  onViewDetails,
  onCancelRide,
  onMarkCompleted,
}: RideCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{ride.routeName}</h3>
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

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Available Students</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users className="h-4 w-4 text-slate-500" />
            {availableStudentsCount}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Boarded Count</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-slate-500" />
            {ride.status === "active" || ride.status === "completed"
              ? ride.boardedCount || 0
              : "-"}
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
