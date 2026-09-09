"use client";

import { ChevronDown, ChevronUp, Download, Bell, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { formatTimeTo12Hour, getInitials } from "@/utils/formatters";
import AvailabilitySummaryBar from "@/components/availability/AvailabilitySummaryBar";
import StudentAvailabilityRow, {
  StudentAvailabilityRowData,
} from "@/components/availability/StudentAvailabilityRow";
import SkeletonLoader from "@/components/ui/SkeletonLoader";

type DriverStatus = "available" | "not_available" | "no_response";

type DriverDetails = {
  name: string;
  phone?: string;
  profileImageUrl?: string;
  status: DriverStatus;
  note?: string;
  vehicleAvailable?: boolean;
};

type RouteAvailabilityCardProps = {
  routeName: string;
  departureTime: string;
  totalStudents: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  drivers: DriverDetails[];
  students: StudentAvailabilityRowData[];
  studentCounts: {
    available: number;
    notAvailable: number;
    noResponse: number;
  };
  sortAscending: boolean;
  onToggleSort: () => void;
  onExportRouteCsv: () => void;
  onSendReminder: () => void;
  reminderDisabled: boolean;
  driverLoading?: boolean;
  studentLoading?: boolean;
  lastUpdated?: Date | null;
};

function getDriverStatusMeta(status: DriverStatus) {
  if (status === "available") {
    return {
      label: "Available",
      classes: "bg-emerald-100 text-emerald-800",
    };
  }

  if (status === "not_available") {
    return {
      label: "Not Available",
      classes: "bg-rose-100 text-rose-800",
    };
  }

  return {
    label: "No Response",
    classes: "bg-amber-100 text-amber-800",
  };
}

export default function RouteAvailabilityCard({
  routeName,
  departureTime,
  totalStudents,
  expanded,
  onToggleExpanded,
  drivers,
  students,
  studentCounts,
  sortAscending,
  onToggleSort,
  onExportRouteCsv,
  onSendReminder,
  reminderDisabled,
  driverLoading,
  studentLoading,
  lastUpdated,
}: RouteAvailabilityCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 bg-white">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{routeName}</h2>
          <p className="text-sm text-slate-600">
            {departureTime ? `${formatTimeTo12Hour(departureTime)} departure • ` : ""}{totalStudents}{" "}
            students
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={onExportRouteCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={onSendReminder}
            disabled={reminderDisabled}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            <Bell size={16} />
            Send Reminder
          </button>
          <button
            onClick={onToggleExpanded}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded ? "Hide Details" : "Show Details"}
          </button>
        </div>
      </header>

      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 relative">
          {driverLoading ? (
            <div className="animate-pulse flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/6 bg-slate-200 rounded" />
              </div>
              <div className="h-8 w-24 bg-slate-200 rounded-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {drivers.length > 0 ? drivers.map((driver, idx) => {
                const driverStatusMeta = getDriverStatusMeta(driver.status);
                return (
                  <div key={idx} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {driver.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={driver.profileImageUrl}
                            alt={driver.name}
                            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                            {getInitials(driver.name)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{driver.name}</p>
                          <p className="text-sm text-slate-600">
                            {driver.phone || "No phone"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${driverStatusMeta.classes}`}
                      >
                        {driverStatusMeta.label}
                      </span>
                    </div>

                    {driver.status === "not_available" && !driverLoading ? (
                      <>
                        {driver.note ? (
                          <p className="mt-3 text-sm text-rose-700">
                            Driver note: {driver.note}
                          </p>
                        ) : null}
                        {driver.vehicleAvailable === false ? (
                          <p className="mt-1 text-sm font-medium text-rose-700">
                            Vehicle unavailable
                          </p>
                        ) : null}
                        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                          Backup driver required
                        </div>
                      </>
                    ) : null}

                    {idx < drivers.length - 1 && (
                      <hr className="border-slate-200" />
                    )}
                  </div>
                );
              }) : (
                <div className="text-sm text-slate-500">Unassigned Driver</div>
              )}
            </div>
          )}
        </div>

        {studentLoading ? (
          <div className="space-y-3">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-200 animate-pulse w-1/2" />
            </div>
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ) : (
          <AvailabilitySummaryBar
            available={studentCounts.available}
            notAvailable={studentCounts.notAvailable}
            noResponse={studentCounts.noResponse}
          />
        )}

        {expanded ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-700">
                Student Responses
              </h3>
              <button
                onClick={onToggleSort}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-white print:hidden"
              >
                Sort: {sortAscending ? "A to Z" : "Z to A"}
              </button>
            </div>
            <div className="overflow-x-auto">
              {studentLoading ? (
                <div className="p-4 space-y-3">
                  <SkeletonLoader variant="table" rows={3} />
                </div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">
                        Student
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Pickup Stop
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Drop Stop
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Note
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Marked At
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <StudentAvailabilityRow
                        key={student.userId}
                        student={student}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}

        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2 italic">
            <Clock size={10} />
            <span>
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
