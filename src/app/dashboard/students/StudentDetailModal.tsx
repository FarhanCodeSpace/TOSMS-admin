"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { format, subMonths } from "date-fns";
import { collection, query, where, getDocs } from "firebase/firestore";
import { MapPin, Calendar, Trash2, Pause, Play, CheckCircle, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { User, Route, FeePayment, Availability } from "@/types";
import { getInitials, formatTimeTo12Hour } from "@/utils/formatters";
import { formatDisplayPhone } from "@/lib/utils";

type StudentDetailModalProps = {
  open: boolean;
  onClose: () => void;
  student: User & { assignedRouteNames?: string[] };
  routes: Route[];
  drivers?: User[];
  feePayments: FeePayment[];
  onSuspend?: () => void;
  onDelete?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
};

export default function StudentDetailModal({
  open,
  onClose,
  student,
  routes,
  drivers = [],
  feePayments,
  onSuspend,
  onDelete,
  onApprove,
  onReject,
}: StudentDetailModalProps) {
  const assignedRoutes = useMemo(() => {
    return routes.filter((r) => {
      const rId = (student as any).routeId;
      const rIds = student.assignedRouteIds;
      
      const inRouteIdString = typeof rId === 'string' && rId === r.routeId;
      const inRouteIdArray = Array.isArray(rId) && rId.includes(r.routeId);
      const inAssignedRouteIds = Array.isArray(rIds) && rIds.includes(r.routeId);
      
      return inRouteIdString || inRouteIdArray || inAssignedRouteIds;
    });
  }, [routes, student]);

  const [studentPayments, setStudentPayments] = useState<FeePayment[]>([]);
  const [availabilityLogs, setAvailabilityLogs] = useState<Availability[]>([]);

  useEffect(() => {
    if (!open || !student?.uid) return;

    const fetchStudentData = async () => {
      try {
        const paymentsQuery = query(
          collection(db, COLLECTIONS.FEE_PAYMENTS),
          where("studentId", "==", student.uid)
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        setStudentPayments(paymentsSnap.docs.map(doc => doc.data() as FeePayment));

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = format(sevenDaysAgo, "yyyy-MM-dd");

        const availQuery = query(
          collection(db, COLLECTIONS.AVAILABILITY),
          where("userId", "==", student.uid),
          where("date", ">=", sevenDaysAgoStr)
        );
        const availSnap = await getDocs(availQuery);
        setAvailabilityLogs(availSnap.docs.map(doc => doc.data() as Availability));
      } catch (error) {
        console.error("Error fetching student details data:", error);
      }
    };

    fetchStudentData();
  }, [open, student?.uid]);

  // Get payment history (up to last 6 months based on joining date)
  const paymentHistory = useMemo(() => {
    const displayCount = (() => {
      if (!student.createdAt) return 6;
      const createdDate = typeof student.createdAt.toDate === "function" ? student.createdAt.toDate() : new Date(student.createdAt as any);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - createdDate.getFullYear()) * 12 + now.getMonth() - createdDate.getMonth();
      return Math.min(6, Math.max(1, monthsDiff + 1));
    })();

    const months = Array.from({ length: displayCount }, (_, i) => {
      const date = subMonths(new Date(), displayCount - 1 - i);
      return format(date, "yyyy-MM");
    });

    return months.map((monthKey) => {
      const payment = studentPayments.find(
        (p) => p.month === monthKey,
      );
      
      let status = "no_data";
      if (payment) {
        if (payment.paymentStatus === "verified") {
          status = "verified";
        } else if (payment.paymentStatus === "submitted" || payment.paymentStatus === "pending") {
          status = payment.paymentStatus;
        }
      } else {
        status = "due";
      }

      return {
        month: format(new Date(monthKey), "MMM"),
        status,
      };
    });
  }, [studentPayments, student.createdAt]);

  // Availability history (last 7 days ending today)
  const availabilityHistory = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = format(date, "yyyy-MM-dd");
      
      const log = availabilityLogs.find(a => a.date === dateStr);
      let status = "not_marked";
      if (log) {
        status = log.isAvailable ? "available" : "unavailable";
      }
      
      return {
        day: format(date, "EEE"),
        date: dateStr,
        status,
      };
    });
  }, [availabilityLogs]);

  const getFeeStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-emerald-100 text-emerald-700";
      case "due":
      case "unpaid":
        return "bg-rose-100 text-rose-700";
      case "no_data":
      case "pending":
      case "submitted":
      default:
        return "bg-slate-100 text-slate-500";
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-100 text-emerald-700";
      case "unavailable":
        return "bg-rose-100 text-rose-700";
      case "not_marked":
      default:
        return "bg-slate-100 text-slate-500";
    }
  };

  const effectiveStatus = student.status || (student.approved ? "active" : "pending");
  const isPending = effectiveStatus === "pending";
  const isSuspended = effectiveStatus === "suspended";
  const isApproved = effectiveStatus === "approved" || effectiveStatus === "active";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${student.fullName} - Details`}
      footer={
        <div className="flex gap-2 w-full">
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 inline-flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          
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
                Approve Student
              </button>
            </>
          )}

          {isSuspended && onSuspend && (
            <button
              onClick={onSuspend}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Reactivate Student
            </button>
          )}

          {isApproved && onSuspend && (
            <button
              onClick={onSuspend}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Suspend Student
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6 pr-4">
        {/* Header Info */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center pb-6 border-b border-slate-200">
          {student.profileImageUrl ? (
            <Image
              src={student.profileImageUrl}
              alt={student.fullName}
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
              {getInitials(student.fullName || "")}
            </div>
          )}

          <div className="flex-1">
            <h3 className="text-xl font-semibold text-slate-900">
              {student.fullName}
            </h3>
            <p className="text-slate-600">{student.email}</p>
            <p className="text-slate-600">{formatDisplayPhone(student.phone || (student as any).phoneNumber)}</p>
            <div className="mt-2">
              <Badge status={student.status || (student.approved ? "active" : "pending")} />
            </div>
          </div>
        </div>

        {/* Member Since */}
        <div>
          <p className="text-sm font-medium text-slate-600">Member Since</p>
          <p className="text-sm text-slate-900 mt-1">
            {student.createdAt
              ? format(student.createdAt.toDate(), "MMM d, yyyy")
              : "N/A"}
          </p>
        </div>

        {/* Identity Documents */}
        <div className="rounded-xl border border-slate-200 p-5 bg-white">
          <h4 className="font-semibold text-slate-900 mb-4">Identity Documents</h4>
          {(!student.cnic && !student.cnicNumber && !student.cnicFrontUrl && !student.cnicBackUrl) ? (
            <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-100">
              <p className="text-slate-500 text-sm">No CNIC documents uploaded</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-600">CNIC Number</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {student.cnic || student.cnicNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">University / Institute</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {student.university || student.universityName || student.instituteName || student.institute || student.college || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                {student.cnicFrontUrl && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Front</p>
                    <Image
                      src={student.cnicFrontUrl}
                      alt="CNIC Front"
                      width={192}
                      height={128}
                      unoptimized
                      className="h-32 w-48 object-cover rounded-md border border-gray-200 bg-white"
                    />
                  </div>
                )}
                {student.cnicBackUrl && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Back</p>
                    <Image
                      src={student.cnicBackUrl}
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

        {/* Route Section */}
        {!isPending && (
          <div className="rounded-xl border border-slate-200 p-5 bg-white">
            <h4 className="font-semibold text-slate-900 mb-4">Route Assignment</h4>
          {assignedRoutes.length > 0 ? (
            <div className="space-y-3">
              {assignedRoutes.map((route) => {
                let pStop = "-";
                let dStop = "-";
                if (student.routeStops && student.routeStops[route.routeId]) {
                   pStop = student.routeStops[route.routeId].pickupStop || "-";
                   dStop = student.routeStops[route.routeId].dropStop || "-";
                } else if (
                  student.routeId === route.routeId || 
                  (Array.isArray((student as any).routeId) && (student as any).routeId.includes(route.routeId)) ||
                  (Array.isArray(student.assignedRouteIds) && student.assignedRouteIds.includes(route.routeId)) ||
                  assignedRoutes.length === 1
                ) {
                   pStop = student.pickupStop || "-";
                   dStop = student.dropStop || "-";
                }

                const routeDriverIds = new Set<string>();
                if (route.assignedDriverId) routeDriverIds.add(route.assignedDriverId);
                if (Array.isArray(route.assignedDriverIds)) {
                  route.assignedDriverIds.forEach(id => routeDriverIds.add(id));
                }
                
                const matchedDrivers = drivers.filter(d => routeDriverIds.has(d.uid));
                const driverNames = matchedDrivers.length > 0 
                  ? matchedDrivers.map(d => d.fullName).join(", ")
                  : (route.assignedDriverName || "No Driver");

                return (
                <div key={route.routeId} className="rounded-lg bg-blue-50/50 p-4 border border-blue-100">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {route.routeName}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 ml-6">
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Pickup Stop
                        </p>
                        <p className="text-sm text-slate-900 mt-0.5">{pStop}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Drop Stop
                        </p>
                        <p className="text-sm text-slate-900 mt-0.5">{dStop}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Driver</p>
                        <p className="text-sm text-slate-900 mt-0.5">
                          {driverNames}
                        </p>
                      </div>
                      {(route.departureTime || route.returnTime) && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            {route.departureTime && route.returnTime ? "Schedule" : route.departureTime ? "Departure Time" : "Return Time"}
                          </p>
                          <p className="text-sm text-slate-900 mt-0.5">
                            {route.departureTime && route.returnTime 
                              ? `${formatTimeTo12Hour(route.departureTime)} - ${formatTimeTo12Hour(route.returnTime)}`
                              : route.departureTime
                                ? formatTimeTo12Hour(route.departureTime)
                                : route.returnTime ? formatTimeTo12Hour(route.returnTime) : ""}
                          </p>
                        </div>
                      )}
                    </div>
                    <a
                      href={`/dashboard/routes?routeId=${route.routeId}`}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-block mt-2 ml-6"
                    >
                      View Route →
                    </a>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="bg-orange-50 p-4 rounded-lg text-center border border-orange-100">
              <p className="text-orange-700 text-sm">No routes assigned</p>
            </div>
          )}
          </div>
        )}

        {/* Payment History Section */}
        {!isPending && (
          <div className="rounded-xl border border-slate-200 p-5 bg-white">
            <h4 className="font-semibold text-slate-900 mb-4">
              Payment History (Last 6 Months)
            </h4>
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
            <div className="flex gap-4 text-xs mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></div>
                <span>Paid/Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-rose-100 border border-rose-300"></div>
                <span>Due/Unpaid</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-100 border border-slate-300"></div>
                <span>No Data/Pending</span>
              </div>
            </div>
          </div>
        )}

        {/* Availability History Section */}
        {!isPending && (
          <div className="rounded-xl border border-slate-200 p-5 bg-white">
            <h4 className="font-semibold text-slate-900 mb-4">
              Availability (Last 7 Days)
            </h4>
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
            <div className="flex gap-4 text-xs mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-rose-100 border border-rose-300"></div>
                <span>Unavailable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-100 border border-slate-300"></div>
                <span>No Response</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
