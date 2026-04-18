"use client";

import { format } from "date-fns";
import { Route } from "@/types";
import { formatTimeTo12Hour } from "@/utils/formatters";
import { StudentAvailabilityRowData } from "@/components/availability/StudentAvailabilityRow";

type DriverStatus = "available" | "not_available" | "no_response";

type RouteReport = {
  route: Route;
  driver: {
    name: string;
    phone?: string;
    status: DriverStatus;
    note?: string;
    vehicleAvailable?: boolean;
  };
  students: StudentAvailabilityRowData[];
  counts: {
    available: number;
    notAvailable: number;
    noResponse: number;
  };
};

type PrintableAvailabilityReportProps = {
  selectedDate: Date;
  reportGeneratedAt: Date;
  routeReports: RouteReport[];
  summary: {
    available: number;
    notAvailable: number;
    noResponse: number;
    routesReady: number;
    totalRoutes: number;
    routesNeedAttention: number;
    noResponsePercent: number;
  };
};

function getStatusLabel(status: DriverStatus): string {
  if (status === "available") return "Available";
  if (status === "not_available") return "Not Available";
  return "Not Responded";
}

function getStudentStatusLabel(
  status: StudentAvailabilityRowData["status"],
): string {
  if (status === "available") return "Available";
  if (status === "not_available") return "Not Available";
  return "No Response";
}

export default function PrintableAvailabilityReport({
  selectedDate,
  reportGeneratedAt,
  routeReports,
  summary,
}: PrintableAvailabilityReportProps) {
  return (
    <div className="hidden print:block bg-white">
      <style>{`
        @page {
          size: A4;
          margin: 0.5in;
        }
        
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .print-break {
            page-break-after: always;
          }
          
          .print-avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="print-avoid-break mb-8">
        <div className="border-b-4 border-slate-900 pb-4">
          <h1 className="text-3xl font-bold text-slate-900">TOSMS</h1>
          <p className="text-sm text-slate-600 mt-1">
            Transport Operations & Student Management System
          </p>
        </div>

        <div className="mt-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Daily Availability Report
          </h2>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-slate-600 font-medium">Report Date</p>
              <p className="text-slate-900 font-semibold">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-slate-600 font-medium">Generated At</p>
              <p className="text-slate-900 font-semibold">
                {format(reportGeneratedAt, "MMM d, yyyy h:mm a")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="print-avoid-break mb-8 border-t-2 border-slate-200 pt-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Summary</h3>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="border-l-4 border-emerald-600 pl-3">
            <p className="text-slate-600">Total Available</p>
            <p className="text-2xl font-bold text-emerald-700">
              {summary.available}
            </p>
            <p className="text-xs text-slate-500 mt-1">Students + Drivers</p>
          </div>
          <div className="border-l-4 border-rose-600 pl-3">
            <p className="text-slate-600">Not Available</p>
            <p className="text-2xl font-bold text-rose-700">
              {summary.notAvailable}
            </p>
            <p className="text-xs text-slate-500 mt-1">Students + Drivers</p>
          </div>
          <div className="border-l-4 border-amber-600 pl-3">
            <p className="text-slate-600">No Response</p>
            <p className="text-2xl font-bold text-amber-700">
              {summary.noResponse}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {summary.noResponsePercent}% of total
            </p>
          </div>
          <div className="border-l-4 border-blue-600 pl-3">
            <p className="text-slate-600">Routes Ready</p>
            <p className="text-2xl font-bold text-blue-700">
              {summary.routesReady}/{summary.totalRoutes}
            </p>
            {summary.routesNeedAttention > 0 ? (
              <p className="text-xs text-rose-600 font-semibold mt-1">
                {summary.routesNeedAttention} need attention
              </p>
            ) : (
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                All ready
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t-2 border-slate-200 pt-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">
          Routes Breakdown
        </h3>

        {routeReports.map((report, index) => (
          <div
            key={report.route.routeId}
            className={`print-avoid-break mb-6 pb-6 ${index < routeReports.length - 1 ? "border-b border-slate-200" : ""}`}
          >
            <div className="mb-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">
                    {report.route.routeName}
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Departure: {formatTimeTo12Hour(report.route.departureTime)}{" "}
                    • {(report.route.studentIds || []).length} students
                  </p>
                </div>
              </div>
            </div>

            <div className="ml-0 mb-4">
              <div className="text-sm font-semibold text-slate-900 mb-2">
                Driver
              </div>
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {report.driver.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {report.driver.phone || "No phone on file"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {getStatusLabel(report.driver.status)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {report.driver.status === "available"
                        ? "Ready"
                        : report.driver.status === "not_available"
                          ? "Unavailable"
                          : "No Response"}
                    </p>
                  </div>
                </div>
                {report.driver.note && (
                  <p className="text-xs text-slate-700 border-t border-slate-200 pt-2">
                    Note: {report.driver.note}
                  </p>
                )}
                {report.driver.vehicleAvailable === false && (
                  <p className="text-xs text-rose-700 font-semibold border-t border-slate-200 pt-2">
                    Vehicle Status: Unavailable
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-900 mb-2">
                Student Summary
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-2 bg-emerald-600 rounded"></div>
                  <span>
                    Available:{" "}
                    <span className="font-semibold">
                      {report.counts.available}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-2 bg-rose-600 rounded"></div>
                  <span>
                    Not Available:{" "}
                    <span className="font-semibold">
                      {report.counts.notAvailable}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-2 bg-slate-400 rounded"></div>
                  <span>
                    No Response:{" "}
                    <span className="font-semibold">
                      {report.counts.noResponse}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {report.students.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-900 mb-2">
                  Student Responses
                </div>
                <div className="border border-slate-300 rounded overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300">
                          <th className="text-left px-3 py-2 font-semibold text-slate-900">
                            Name
                          </th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-900">
                            Pickup Stop
                          </th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-900">
                            Status
                          </th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-900">
                            Notes
                          </th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-900">
                            Time Marked
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.students.map((student, idx) => (
                          <tr
                            key={student.userId}
                            className={`border-b border-slate-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                          >
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {student.name}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {student.pickupStop || "-"}
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-semibold">
                                {getStudentStatusLabel(student.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {student.note ||
                                (student.reminderSent ? "Reminder sent" : "-")}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {student.markedAt
                                ? format(
                                    student.markedAt instanceof Date
                                      ? student.markedAt
                                      : student.markedAt.toDate(),
                                    "h:mm a",
                                  )
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t-2 border-slate-200 text-xs text-slate-500 flex justify-between">
        <div>TOSMS Admin Panel</div>
        <div>
          Page {Math.ceil(routeReports.length / 3)} of{" "}
          {Math.ceil(routeReports.length / 3)}
        </div>
      </div>
    </div>
  );
}
