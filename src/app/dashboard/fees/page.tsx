"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import {
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  Loader2,
  AlertCircle,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import type { FeePayment, User, Route } from "@/types";
import {
  formatPKR,
  formatTimestamp,
  formatPaymentMethod,
} from "@/utils/formatters";
import { getCurrentMonthString, formatMonthDisplay } from "@/utils/dateHelpers";
import StatsCard from "@/components/ui/StatsCard";
import PaymentCard from "@/components/fees/PaymentCard";
import ReceiptModal from "@/components/fees/ReceiptModal";
import RevenueChart from "@/components/fees/RevenueChart";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { format, subMonths, addMonths } from "date-fns";

type TabType = "pending" | "all" | "outstanding" | "exempt";
type SortKey = "name" | "amount" | "date" | "status";

type RevenueSummary = {
  month: string;
  collected: number;
  outstanding: number;
};

export default function FeesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthString());
  const [allPayments, setAllPayments] = useState<FeePayment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<FeePayment[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Summary card data
  const [totalCollected, setTotalCollected] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [outstandingCount, setOutstandingCount] = useState(0);

  // Tabs state
  const [statusFilter, setStatusFilter] = useState<
    "all" | "verified" | "submitted" | "pending"
  >("all");
  const [methodFilter, setMethodFilter] = useState<
    "all" | "bank_challan" | "easypaisa" | "jazzcash"
  >("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [currentPage, setCurrentPage] = useState(1);

  // Outstanding fees state
  const [outstandingStudents, setOutstandingStudents] = useState<
    (User & { monthlyFeeAmount: number; daysSinceStart: number })[]
  >([]);
  const [selectedOutstandingStudents, setSelectedOutstandingStudents] =
    useState<string[]>([]);
  const [outstandingPageIndex, setOutstandingPageIndex] = useState(1);
  const [exemptPageIndex, setExemptPageIndex] = useState(1);

  // Revenue chart data
  const [revenueData, setRevenueData] = useState<RevenueSummary[]>([]);

  // Modal states
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  const itemsPerPage = 20;

  // Fetch all students
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "student")),
      (snapshot) => {
        const students = snapshot.docs.map((doc) => doc.data() as User);
        setAllStudents(students);
      },
    );
    return () => unsubscribe();
  }, []);

  // Fetch all routes
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.ROUTES),
      (snapshot) => {
        const routesData = snapshot.docs.map(
          (doc) => ({ ...doc.data(), routeId: doc.id }) as Route,
        );
        setRoutes(routesData);
      },
    );
    return () => unsubscribe();
  }, []);

  // Fetch payments for selected month
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.FEE_PAYMENTS),
        where("month", "==", selectedMonth),
      ),
      (snapshot) => {
        const payments = snapshot.docs
          .map((doc) => ({ ...doc.data(), paymentId: doc.id }) as FeePayment)
          .sort(
            (a, b) =>
              (b.submittedAt?.toMillis?.() ?? 0) -
              (a.submittedAt?.toMillis?.() ?? 0),
          );
        setAllPayments(payments);

        // Calculate summary stats
        const submitted = payments.filter(
          (p) => p.paymentStatus === "submitted",
        );
        const verified = payments.filter((p) => p.paymentStatus === "verified");
        const collected = verified.reduce((sum, p) => sum + p.amount, 0);

        setPendingPayments(submitted);
        setPendingCount(submitted.length);
        setVerifiedCount(verified.length);
        setTotalCollected(collected);

        // Calculate outstanding
        const studentsWithPayments = new Set(
          payments
            .filter(
              (p) =>
                p.feeExempt === true ||
                p.paymentStatus === "verified" ||
                p.paymentStatus === "submitted",
            )
            .map((p) => p.studentId),
        );
        const outstandingStudentCount =
          allStudents.length - studentsWithPayments.size;
        setOutstandingCount(outstandingStudentCount);

        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [selectedMonth, allStudents.length]);

  // Calculate outstanding fees students
  useEffect(() => {
    const outstanding = allStudents.map((student) => {
      const payment = allPayments.find((p) => p.studentId === student.uid);
      const route = routes.find((r) => r.routeId === student.routeId);
      const monthStart = new Date(`${selectedMonth}-01`);
      const daysSinceStart = Math.floor(
        (new Date().getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        ...student,
        monthlyFeeAmount: route?.feeAmount || 0,
        daysSinceStart,
      };
    });

    const filtered = outstanding.filter(
      (s) =>
        !allPayments.find(
          (p) =>
            p.studentId === s.uid &&
            (p.feeExempt === true ||
              p.paymentStatus === "verified" ||
              p.paymentStatus === "submitted"),
        ),
    );

    setOutstandingStudents(filtered);
  }, [allStudents, allPayments, routes, selectedMonth]);

  // Fetch revenue data for last 6 months
  useEffect(() => {
    const fetchRevenueData = async () => {
      const data: RevenueSummary[] = [];
      const currentDate = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(currentDate, i);
        const monthStr = format(monthDate, "yyyy-MM");

        const paymentsSnapshot = await getDocs(
          query(
            collection(db, COLLECTIONS.FEE_PAYMENTS),
            where("month", "==", monthStr),
          ),
        );

        const payments = paymentsSnapshot.docs.map(
          (doc) => doc.data() as FeePayment,
        );
        const verified = payments.filter((p) => p.paymentStatus === "verified");
        const collected = verified.reduce((sum, p) => sum + p.amount, 0);

        // Outstanding = total potential fees - collected
        const totalPotentialFees = allStudents.length * 5000; // Assuming 5000 PKR average fee
        const outstanding = totalPotentialFees - collected;

        data.push({
          month: monthStr,
          collected,
          outstanding: Math.max(0, outstanding),
        });
      }

      setRevenueData(data);
    };

    if (allStudents.length > 0) {
      fetchRevenueData();
    }
  }, [allStudents.length]);

  // Filter and sort all payments for the "All Payments" tab
  const filteredAllPayments = useMemo(() => {
    let filtered = allPayments.filter((p) => p.feeExempt !== true);

    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.paymentStatus === statusFilter);
    }
    if (methodFilter !== "all") {
      filtered = filtered.filter((p) => p.paymentMethod === methodFilter);
    }
    if (routeFilter !== "all") {
      filtered = filtered.filter((p) => p.routeId === routeFilter);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.studentName.localeCompare(b.studentName);
        case "amount":
          return b.amount - a.amount;
        case "date":
          return (
            (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0)
          );
        case "status":
          return a.paymentStatus.localeCompare(b.paymentStatus);
        default:
          return 0;
      }
    });

    return sorted;
  }, [allPayments, statusFilter, methodFilter, routeFilter, sortBy]);

  // Paginate for all payments tab
  const totalPages = Math.ceil(filteredAllPayments.length / itemsPerPage);
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAllPayments.slice(start, start + itemsPerPage);
  }, [filteredAllPayments, currentPage]);

  // Paginate for outstanding fees
  const outstandingPagesCount = Math.ceil(
    outstandingStudents.length / itemsPerPage,
  );
  const paginatedOutstanding = useMemo(() => {
    const start = (outstandingPageIndex - 1) * itemsPerPage;
    return outstandingStudents.slice(start, start + itemsPerPage);
  }, [outstandingStudents, outstandingPageIndex]);

  const exemptPayments = useMemo(
    () =>
      allPayments
        .filter((p) => p.feeExempt === true)
        .sort(
          (a, b) =>
            (b.exemptedAt?.toMillis?.() ?? b.submittedAt?.toMillis?.() ?? 0) -
            (a.exemptedAt?.toMillis?.() ?? a.submittedAt?.toMillis?.() ?? 0),
        ),
    [allPayments],
  );

  const exemptPagesCount = Math.ceil(exemptPayments.length / itemsPerPage);
  const paginatedExemptPayments = useMemo(() => {
    const start = (exemptPageIndex - 1) * itemsPerPage;
    return exemptPayments.slice(start, start + itemsPerPage);
  }, [exemptPayments, exemptPageIndex]);

  const handlePreviousMonth = () => {
    const current = new Date(`${selectedMonth}-01`);
    const previous = subMonths(current, 1);
    setSelectedMonth(format(previous, "yyyy-MM"));
    setCurrentPage(1);
  };

  const handleNextMonth = () => {
    const current = new Date(`${selectedMonth}-01`);
    const next = addMonths(current, 1);
    setSelectedMonth(format(next, "yyyy-MM"));
    setCurrentPage(1);
  };

  const handleReceiptView = (url: string) => {
    setReceiptUrl(url);
    setReceiptModalOpen(true);
  };

  const handleExportCSV = () => {
    const csv = generateCSV(paginatedPayments);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fee_payments_${selectedMonth}.csv`;
    link.click();
    toast.success("CSV exported successfully!");
  };

  const handleMarkAsExempt = async (studentId: string) => {
    try {
      const existingPayment = allPayments.find(
        (p) => p.studentId === studentId,
      );

      if (existingPayment) {
        await updateDoc(
          doc(db, COLLECTIONS.FEE_PAYMENTS, existingPayment.paymentId),
          {
            feeExempt: true,
            exemptedAt: serverTimestamp(),
          },
        );
      } else {
        const student = allStudents.find((s) => s.uid === studentId);
        const route = routes.find((r) => r.routeId === student?.routeId);
        const exemptionDocId = `${studentId}_${selectedMonth}_exempt`;

        await setDoc(doc(db, COLLECTIONS.FEE_PAYMENTS, exemptionDocId), {
          studentId,
          studentName: student?.fullName || "Unknown Student",
          routeId: student?.routeId || "",
          month: selectedMonth,
          amount: route?.feeAmount || 0,
          paymentMethod: "bank_challan",
          paymentStatus: "pending",
          feeExempt: true,
          exemptedAt: serverTimestamp(),
          submittedAt: serverTimestamp(),
        });
      }

      toast.success(`Student marked as exempt for ${selectedMonth}`);
    } catch (error) {
      console.error("Mark as exempt error:", error);
      toast.error("Failed to mark as exempt");
    }
  };

  const handleSendReminders = async () => {
    if (selectedOutstandingStudents.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    setReminderLoading(true);
    try {
      // Update reminderSentAt for selected students
      for (const studentId of selectedOutstandingStudents) {
        await updateDoc(doc(db, COLLECTIONS.USERS, studentId), {
          reminderSentAt: serverTimestamp(),
        });
      }

      toast.success(
        `Reminders sent to ${selectedOutstandingStudents.length} student(s)`,
      );
      setSelectedOutstandingStudents([]);
      setReminderConfirmOpen(false);
    } catch (error) {
      console.error("Send reminder error:", error);
      toast.error("Failed to send reminders");
    } finally {
      setReminderLoading(false);
    }
  };

  const getStatusBadgeClass = (payment: FeePayment) => {
    if (payment.feeExempt) {
      return "bg-violet-100 text-violet-800";
    }

    switch (payment.paymentStatus) {
      case "verified":
        return "bg-green-100 text-green-800";
      case "submitted":
        return "bg-orange-100 text-orange-800";
      case "pending":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Fee Management</h1>
        <p className="text-slate-600 mt-1">Manage student payments and fees</p>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <button
          onClick={handlePreviousMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-lg font-semibold text-slate-900">
            {formatMonthDisplay(selectedMonth)}
          </p>
        </div>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Collected"
          value={formatPKR(totalCollected)}
          label="Verified Payments"
          icon={<span className="text-xl">✓</span>}
          iconBg="#d1fae5"
          iconColor="#10b981"
        />
        <div className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div
            className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "#fed7aa", color: "#f97316" }}
          >
            <AlertCircle size={24} />
          </div>
          <p className="min-h-[2.75rem] max-w-[calc(100%-4.5rem)] text-sm font-medium leading-5 text-gray-500">
            Pending Verification
          </p>
          <div className="mt-6 flex items-baseline gap-2">
            <p className="text-[32px] font-bold text-[#1A3C5E]">
              {pendingCount}
            </p>
            {pendingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">Submitted payments</p>
          <button
            onClick={() => {
              setActiveTab("pending");
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
            className="mt-5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View pending →
          </button>
        </div>
        <StatsCard
          title="Verified Payments"
          value={verifiedCount}
          label="Completed verifications"
          icon={<span className="text-xl">✓</span>}
          iconBg="#dcfce7"
          iconColor="#16a34a"
        />
        <StatsCard
          title="Outstanding"
          value={outstandingCount}
          label="Students without payment"
          icon={<span className="text-xl">!</span>}
          iconBg="#fee2e2"
          iconColor="#ef4444"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex gap-8 px-6">
            <button
              onClick={() => {
                setActiveTab("pending");
                setCurrentPage(1);
              }}
              className={`py-4 font-semibold border-b-2 transition-colors ${
                activeTab === "pending"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Pending Verification
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab("all");
                setCurrentPage(1);
              }}
              className={`py-4 font-semibold border-b-2 transition-colors ${
                activeTab === "all"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              All Payments
            </button>
            <button
              onClick={() => {
                setActiveTab("outstanding");
                setOutstandingPageIndex(1);
              }}
              className={`py-4 font-semibold border-b-2 transition-colors ${
                activeTab === "outstanding"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Outstanding Fees
            </button>
            <button
              onClick={() => {
                setActiveTab("exempt");
                setExemptPageIndex(1);
              }}
              className={`py-4 font-semibold border-b-2 transition-colors ${
                activeTab === "exempt"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Exempt Fees
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* TAB 1: Pending Verification */}
          {activeTab === "pending" && (
            <div className="space-y-4">
              {pendingPayments.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-slate-600">
                    No pending payments for verification
                  </p>
                </div>
              ) : (
                pendingPayments.map((payment) => (
                  <PaymentCard
                    key={payment.paymentId}
                    payment={payment}
                    onReceiptView={handleReceiptView}
                  />
                ))
              )}
            </div>
          )}

          {/* TAB 2: All Payments */}
          {activeTab === "all" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(
                        e.target.value as
                          | "all"
                          | "verified"
                          | "submitted"
                          | "pending",
                      );
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="verified">Verified</option>
                    <option value="submitted">Submitted</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={methodFilter}
                    onChange={(e) => {
                      setMethodFilter(
                        e.target.value as
                          | "all"
                          | "bank_challan"
                          | "easypaisa"
                          | "jazzcash",
                      );
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Methods</option>
                    <option value="bank_challan">Bank Deposit</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="jazzcash">JazzCash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Route
                  </label>
                  <select
                    value={routeFilter}
                    onChange={(e) => {
                      setRouteFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Routes</option>
                    {routes.map((route) => (
                      <option key={route.routeId} value={route.routeId}>
                        {route.routeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as SortKey);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="date">Date (Newest First)</option>
                    <option value="name">Student Name</option>
                    <option value="amount">Amount (Highest First)</option>
                    <option value="status">Status</option>
                  </select>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
                >
                  <DownloadCloud size={16} />
                  Export CSV
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Student Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Route
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Method
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Submitted
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Verified
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-slate-600"
                        >
                          No payments found
                        </td>
                      </tr>
                    ) : (
                      paginatedPayments.map((payment) => (
                        <tr
                          key={payment.paymentId}
                          className="border-b border-slate-200 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {payment.studentName}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {routes.find((r) => r.routeId === payment.routeId)
                              ?.routeName || payment.routeId}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatPaymentMethod(payment.paymentMethod)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatPKR(payment.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                                payment,
                              )}`}
                            >
                              {payment.feeExempt
                                ? "Exempt"
                                : payment.paymentStatus === "verified"
                                  ? "Verified"
                                  : payment.paymentStatus === "submitted"
                                    ? "Submitted"
                                    : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatTimestamp(payment.submittedAt)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {payment.verifiedAt
                              ? formatTimestamp(payment.verifiedAt)
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredAllPayments.length,
                    )}{" "}
                    of {filteredAllPayments.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            currentPage === page
                              ? "bg-blue-600 text-white"
                              : "border border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      ),
                    )}
                    <button
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Exempt Fees */}
          {activeTab === "exempt" && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Student Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Route
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Fee Amount
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Month
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Exempted At
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExemptPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-slate-600"
                        >
                          No exempt records for this month
                        </td>
                      </tr>
                    ) : (
                      paginatedExemptPayments.map((payment) => (
                        <tr
                          key={payment.paymentId}
                          className="border-b border-slate-200 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {payment.studentName}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {routes.find((r) => r.routeId === payment.routeId)
                              ?.routeName ||
                              payment.routeId ||
                              "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatPKR(payment.amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {payment.month}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatTimestamp(
                              payment.exemptedAt || payment.submittedAt,
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                              Exempt
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {exemptPagesCount > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Showing {(exemptPageIndex - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(
                      exemptPageIndex * itemsPerPage,
                      exemptPayments.length,
                    )}{" "}
                    of {exemptPayments.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setExemptPageIndex(Math.max(1, exemptPageIndex - 1))
                      }
                      disabled={exemptPageIndex === 1}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from(
                      { length: exemptPagesCount },
                      (_, i) => i + 1,
                    ).map((page) => (
                      <button
                        key={page}
                        onClick={() => setExemptPageIndex(page)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          exemptPageIndex === page
                            ? "bg-blue-600 text-white"
                            : "border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setExemptPageIndex(
                          Math.min(exemptPagesCount, exemptPageIndex + 1),
                        )
                      }
                      disabled={exemptPageIndex === exemptPagesCount}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Outstanding Fees */}
          {activeTab === "outstanding" && (
            <div className="space-y-4">
              {selectedOutstandingStudents.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setReminderConfirmOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
                  >
                    <Mail size={16} />
                    Send Fee Reminder ({selectedOutstandingStudents.length})
                  </button>
                  <button
                    onClick={() => setSelectedOutstandingStudents([])}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Clear Selection
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={
                            paginatedOutstanding.length > 0 &&
                            paginatedOutstanding.every((s) =>
                              selectedOutstandingStudents.includes(s.uid),
                            )
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOutstandingStudents([
                                ...selectedOutstandingStudents,
                                ...paginatedOutstanding.map((s) => s.uid),
                              ]);
                            } else {
                              setSelectedOutstandingStudents(
                                selectedOutstandingStudents.filter(
                                  (id) =>
                                    !paginatedOutstanding.some(
                                      (s) => s.uid === id,
                                    ),
                                ),
                              );
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Student Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Route
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Monthly Fee
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Days Since Month Start
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOutstanding.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-slate-600"
                        >
                          No outstanding fees
                        </td>
                      </tr>
                    ) : (
                      paginatedOutstanding.map((student) => (
                        <tr
                          key={student.uid}
                          className="border-b border-slate-200 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedOutstandingStudents.includes(
                                student.uid,
                              )}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOutstandingStudents([
                                    ...selectedOutstandingStudents,
                                    student.uid,
                                  ]);
                                } else {
                                  setSelectedOutstandingStudents(
                                    selectedOutstandingStudents.filter(
                                      (id) => id !== student.uid,
                                    ),
                                  );
                                }
                              }}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {student.fullName}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {routes.find((r) => r.routeId === student.routeId)
                              ?.routeName ||
                              student.routeId ||
                              "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatPKR(student.monthlyFeeAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {student.daysSinceStart}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleMarkAsExempt(student.uid)}
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Mark as Exempt
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {outstandingPagesCount > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Showing {(outstandingPageIndex - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(
                      outstandingPageIndex * itemsPerPage,
                      outstandingStudents.length,
                    )}{" "}
                    of {outstandingStudents.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setOutstandingPageIndex(
                          Math.max(1, outstandingPageIndex - 1),
                        )
                      }
                      disabled={outstandingPageIndex === 1}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from(
                      { length: outstandingPagesCount },
                      (_, i) => i + 1,
                    ).map((page) => (
                      <button
                        key={page}
                        onClick={() => setOutstandingPageIndex(page)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          outstandingPageIndex === page
                            ? "bg-blue-600 text-white"
                            : "border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setOutstandingPageIndex(
                          Math.min(
                            outstandingPagesCount,
                            outstandingPageIndex + 1,
                          ),
                        )
                      }
                      disabled={outstandingPageIndex === outstandingPagesCount}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Revenue Chart */}
      <RevenueChart data={revenueData} />

      {/* Modals */}
      <ReceiptModal
        open={receiptModalOpen}
        receiptUrl={receiptUrl}
        onClose={() => setReceiptModalOpen(false)}
      />

      <ConfirmDialog
        open={reminderConfirmOpen}
        title="Send Fee Reminders"
        message={`Send fee reminders to ${selectedOutstandingStudents.length} selected student(s)?`}
        confirmLabel="Send"
        cancelLabel="Cancel"
        onConfirm={handleSendReminders}
        onCancel={() => setReminderConfirmOpen(false)}
        isLoading={reminderLoading}
      />
    </div>
  );
}

// Helper function to generate CSV
function generateCSV(payments: FeePayment[]): string {
  const escapeCsvCell = (value: string) => {
    const safeValue = value.replace(/"/g, '""');
    return `"${safeValue}"`;
  };

  const forceExcelText = (value: string): string => {
    if (!value) return "";
    // Prefix tab to keep Excel from coercing date/month cells into numeric formats.
    return `\t${value}`;
  };

  const formatCsvDate = (timestamp: unknown): string => {
    if (!timestamp) return "";

    const maybeTimestamp = timestamp as { toDate?: () => Date };
    const date =
      typeof maybeTimestamp.toDate === "function"
        ? maybeTimestamp.toDate()
        : timestamp instanceof Date
          ? timestamp
          : null;

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    // Keep CSV dates short and comma-free so Excel displays them reliably.
    return format(date, "yyyy-MM-dd hh:mm a");
  };

  const headers = [
    "Student Name",
    "Route",
    "Month",
    "Amount",
    "Payment Method",
    "Status",
    "Submitted Date",
    "Verified Date",
  ];

  const rows = payments.map((p) => [
    p.studentName,
    p.routeId,
    forceExcelText(p.month),
    `PKR ${p.amount}`,
    formatPaymentMethod(p.paymentMethod),
    p.paymentStatus,
    forceExcelText(formatCsvDate(p.submittedAt)),
    forceExcelText(formatCsvDate(p.verifiedAt)),
  ]);

  const csv =
    headers.join(",") +
    "\n" +
    rows
      .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(","))
      .join("\n");

  return csv;
}
