"use client";

import { useMemo } from "react";
import { format, subMonths } from "date-fns";
import { X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { User, Route, FeePayment } from "@/types";
import { formatPKR, getInitials } from "@/utils/formatters";

type StudentDetailModalProps = {
  open: boolean;
  onClose: () => void;
  student: User & { routeName?: string };
  routes: Route[];
  feePayments: FeePayment[];
};

export default function StudentDetailModal({
  open,
  onClose,
  student,
  routes,
  feePayments,
}: StudentDetailModalProps) {
  const assignedRoute = useMemo(
    () => routes.find((r) => r.routeId === student.routeId),
    [routes, student.routeId],
  );

  // Get payment history for last 6 months
  const paymentHistory = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return format(date, "yyyy-MM");
    });

    return months.map((monthKey) => {
      const payment = feePayments.find(
        (p) => p.studentId === student.uid && p.month === monthKey,
      );
      const status = payment?.paymentStatus || "no_data";
      return {
        month: format(new Date(monthKey), "MMM"),
        status,
      };
    });
  }, [feePayments, student.uid]);

  // Mock availability history (last 7 days)
  const availabilityHistory = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subMonths(new Date(), 0);
      date.setDate(date.getDate() - (6 - i));
      return {
        day: format(date, "EEE"),
        date: date.toDateString(),
        status: ["available", "unavailable", "not_marked"][
          Math.floor(Math.random() * 3)
        ],
      };
    });
  }, []);

  const getFeeStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-emerald-100 text-emerald-700";
      case "submitted":
        return "bg-amber-100 text-amber-700";
      case "due":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-100 text-emerald-700";
      case "unavailable":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${student.fullName} - Details`}
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
        {/* Profile Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Profile</h3>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
              {getInitials(student.fullName || "")}
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium text-slate-600">Name</p>
                <p className="text-slate-900">{student.fullName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Email</p>
                <p className="text-slate-900">{student.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Phone</p>
                <p className="text-slate-900">{student.phone}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Member Since
                </p>
                <p className="text-slate-900">
                  {student.createdAt
                    ? format(student.createdAt.toDate(), "MMM d, yyyy")
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Route Section */}
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Route Assignment</h3>
          </div>
          {assignedRoute ? (
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Assigned Route
                </p>
                <p className="text-slate-900 font-medium">
                  {assignedRoute.routeName}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Pickup Stop
                </p>
                <p className="text-slate-900">{student.pickupStop || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Driver</p>
                <p className="text-slate-900">
                  {assignedRoute.assignedDriverName || "No Driver"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Departure Time
                </p>
                <p className="text-slate-900">{assignedRoute.departureTime}</p>
              </div>
              <button className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                Change Route
              </button>
            </div>
          ) : (
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <p className="text-orange-700 text-sm">No route assigned</p>
              <button className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition">
                Assign Route
              </button>
            </div>
          )}
        </div>

        {/* Payment History Section */}
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <h3 className="font-semibold text-slate-900">
            Payment History (Last 6 Months)
          </h3>
          <div className="flex justify-between gap-2">
            {paymentHistory.map((payment, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded flex items-center justify-center text-xs font-semibold ${getFeeStatusColor(payment.status)}`}
                >
                  {payment.month}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></div>
              <span>Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300"></div>
              <span>Submitted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-rose-100 border border-rose-300"></div>
              <span>Due</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100 border border-slate-300"></div>
              <span>No Data</span>
            </div>
          </div>
        </div>

        {/* Availability History Section */}
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <h3 className="font-semibold text-slate-900">
            Availability (Last 7 Days)
          </h3>
          <div className="flex gap-2">
            {availabilityHistory.map((day, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded flex items-center justify-center text-xs font-semibold ${getAvailabilityColor(day.status)}`}
                >
                  {day.day}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
