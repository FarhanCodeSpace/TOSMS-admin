"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import {
  Download,
  Search,
  Eye,
  GitBranch,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { User, Route, FeePayment } from "@/types";
import Badge from "@/components/ui/Badge";
import StatsCard from "@/components/ui/StatsCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { getInitials } from "@/utils/formatters";
import { removeStudentFromRoute } from "@/utils/firestoreHelpers";
import StudentDetailModal from "./StudentDetailModal";
import AssignStudentToRouteModal from "./AssignStudentToRouteModal";

type StudentWithDetails = User & {
  routeName?: string;
  feeStatus?: "verified" | "submitted" | "due" | "no_data";
};

const ITEMS_PER_PAGE = 20;

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);

  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "assigned" | "unassigned" | "fee_due"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [selectedStudent, setSelectedStudent] =
    useState<StudentWithDetails | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<StudentWithDetails | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);

  // Fetch students
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "student")),
      (snapshot) => {
        const studentsList = snapshot.docs.map((doc) => ({
          ...doc.data(),
          uid: doc.id,
        })) as StudentWithDetails[];
        setStudents(studentsList);
      },
      (error) => {
        console.error("Error fetching students:", error);
        toast.error("Failed to load students");
      },
    );
    return () => unsubscribe();
  }, []);

  // Fetch routes
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.ROUTES),
      (snapshot) => {
        const routesList = snapshot.docs.map((doc) => ({
          ...doc.data(),
          routeId: doc.id,
        })) as Route[];
        setRoutes(routesList);
      },
    );
    return () => unsubscribe();
  }, []);

  // Fetch fee payments for current month
  useEffect(() => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.FEE_PAYMENTS),
        where("month", "==", currentMonth),
      ),
      (snapshot) => {
        const payments = snapshot.docs.map((doc) => ({
          ...doc.data(),
          paymentId: doc.id,
        })) as FeePayment[];
        setFeePayments(payments);
      },
    );
    return () => unsubscribe();
  }, []);

  // Enrich students with route and fee data
  const enrichedStudents = useMemo(() => {
    return students.map((student) => {
      const route = routes.find((r) => r.routeId === student.routeId);
      const payment = feePayments.find((p) => p.studentId === student.uid);

      let feeStatus: "verified" | "submitted" | "due" | "no_data" = "no_data";
      if (payment) {
        feeStatus = payment.paymentStatus as "verified" | "submitted" | "due";
      } else if (!student.routeId) {
        feeStatus = "no_data"; // Unassigned, no fee
      } else {
        feeStatus = "due"; // Has route, no payment = due
      }

      return {
        ...student,
        routeName: route?.routeName,
        feeStatus,
      };
    });
  }, [students, routes, feePayments]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter((student) => {
      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          student.fullName?.toLowerCase().includes(term) ||
          student.email?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filterStatus === "assigned" && !student.routeId) return false;
      if (filterStatus === "unassigned" && student.routeId) return false;
      if (filterStatus === "fee_due" && student.feeStatus !== "due")
        return false;

      return true;
    });
  }, [enrichedStudents, searchTerm, filterStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = enrichedStudents.length;
    const assigned = enrichedStudents.filter((s) => s.routeId).length;
    const unassigned = total - assigned;
    const feeDue = enrichedStudents.filter((s) => s.feeStatus === "due").length;

    return { total, assigned, unassigned, feeDue };
  }, [enrichedStudents]);

  // CSV Export
  const exportCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Route",
      "Pickup Stop",
      "Fee Status",
      "Registration Date",
    ];
    const rows = enrichedStudents.map((student) => [
      student.fullName || "",
      student.email || "",
      student.phone || "",
      student.routeName || "Unassigned",
      student.pickupStop || "-",
      student.feeStatus || "-",
      student.createdAt
        ? format(student.createdAt.toDate(), "yyyy-MM-dd")
        : "-",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `students-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  };

  // Handle remove student
  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      await removeStudentFromRoute(removeTarget.uid, removeTarget.routeId!);
      toast.success("Student removed from route");
      setRemoveConfirmOpen(false);
      setRemoveTarget(null);
    } catch (error) {
      console.error("Error removing student:", error);
      toast.error("Failed to remove student");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleDetailClick = (student: StudentWithDetails) => {
    setSelectedStudent(student);
    setDetailModalOpen(true);
  };

  const handleAssignClick = (student: StudentWithDetails) => {
    setSelectedStudent(student);
    setAssignModalOpen(true);
  };

  const handleRemoveClick = (student: StudentWithDetails) => {
    setRemoveTarget(student);
    setRemoveConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">
          Student Management
        </h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="Total Students"
          value={stats.total}
          label="All students"
          icon={<Users size={24} />}
          iconBg="#e0f2fe"
          iconColor="#0284c7"
        />
        <StatsCard
          title="Assigned to Route"
          value={stats.assigned}
          label="Actively assigned"
          icon={<GitBranch size={24} />}
          iconBg="#f0fdf4"
          iconColor="#16a34a"
        />
        <StatsCard
          title="Unassigned"
          value={stats.unassigned}
          label="Need route"
          icon={
            <div
              className={`text-2xl font-bold ${stats.unassigned > 0 ? "text-orange-600" : "text-slate-400"}`}
            >
              !
            </div>
          }
          iconBg={stats.unassigned > 0 ? "#fed7aa" : "#f1f5f9"}
          iconColor={stats.unassigned > 0 ? "#ea580c" : "#64748b"}
        />
        <StatsCard
          title="Fee Due This Month"
          value={stats.feeDue}
          label="Pending payments"
          icon={<div className="text-xl font-bold text-rose-600">₨</div>}
          iconBg="#ffe4e6"
          iconColor="#e11d48"
        />
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex gap-3">
          <Search size={20} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 bg-transparent outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          {(
            [
              { value: "all", label: "All" },
              { value: "assigned", label: "Assigned" },
              { value: "unassigned", label: "Unassigned" },
              { value: "fee_due", label: "Fee Due" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.value}
              onClick={() => {
                setFilterStatus(filter.value);
                setCurrentPage(1);
              }}
              className={`rounded-full px-4 py-1 text-sm font-medium transition ${
                filterStatus === filter.value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Students Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Student
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Email
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Assigned Route
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Pickup Stop
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Fee Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Registered
              </th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedStudents.map((student) => (
              <tr key={student.uid} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                      {getInitials(student.fullName || "")}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {student.fullName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {student.email}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {student.phone}
                </td>
                <td className="px-6 py-4">
                  {student.routeName ? (
                    <span className="text-sm text-slate-900">
                      {student.routeName}
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                      Unassigned
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {student.pickupStop || "-"}
                </td>
                <td className="px-6 py-4">
                  <Badge status={student.feeStatus || "no_data"}>
                    {student.feeStatus === "verified"
                      ? "Verified"
                      : student.feeStatus === "submitted"
                        ? "Submitted"
                        : student.feeStatus === "due"
                          ? "Due"
                          : "No Fee"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {student.createdAt
                    ? format(student.createdAt.toDate(), "MMM d, yyyy")
                    : "-"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDetailClick(student)}
                      className="p-2 hover:bg-slate-100 rounded transition"
                      title="View details"
                    >
                      <Eye size={18} className="text-slate-600" />
                    </button>
                    <button
                      onClick={() => handleAssignClick(student)}
                      className="p-2 hover:bg-slate-100 rounded transition"
                      title="Assign to route"
                    >
                      <GitBranch size={18} className="text-slate-600" />
                    </button>
                    {student.routeId && (
                      <button
                        onClick={() => handleRemoveClick(student)}
                        className="p-2 hover:bg-rose-50 rounded transition"
                        title="Remove from route"
                      >
                        <Trash2 size={18} className="text-rose-600" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paginatedStudents.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            No students found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className="p-2 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Modals */}
      {selectedStudent && (
        <>
          <StudentDetailModal
            open={detailModalOpen}
            onClose={() => setDetailModalOpen(false)}
            student={selectedStudent}
            routes={routes}
            feePayments={feePayments}
          />
          <AssignStudentToRouteModal
            open={assignModalOpen}
            onClose={() => setAssignModalOpen(false)}
            student={selectedStudent}
            routes={routes}
          />
        </>
      )}

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={removeConfirmOpen}
        title="Remove Student from Route"
        message={`Are you sure you want to remove ${removeTarget?.fullName} from their assigned route? They will need to be reassigned.`}
        confirmLabel="Remove"
        onConfirm={handleRemoveConfirm}
        onCancel={() => {
          setRemoveConfirmOpen(false);
          setRemoveTarget(null);
        }}
        destructive
        isLoading={isRemoving}
      />
    </div>
  );
}
