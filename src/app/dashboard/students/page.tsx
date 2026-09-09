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
  Unlink2,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { User, Route, FeePayment } from "@/types";
import Badge from "@/components/ui/Badge";
import { formatDisplayPhone } from "@/lib/utils";
import StatsCard from "@/components/ui/StatsCard";
import StudentCard from "@/components/students/StudentCard";
import Modal from "@/components/ui/Modal";
import Image from "next/image";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { getInitials } from "@/utils/formatters";
import { isFeeExempt, normalizeFeeStatus } from "@/utils/feeHelpers";
import {
  removeStudentFromRoute,
  deleteStudentAccount,
  resolvePendingRegistrationNotification,
} from "@/utils/firestoreHelpers";
import StudentDetailModal from "./StudentDetailModal";
import AssignStudentToRouteModal from "./AssignStudentToRouteModal";
import CNICReviewModal from "@/components/ui/CNICReviewModal";
import { updateDoc, doc, writeBatch, serverTimestamp } from "firebase/firestore";

type AssignedRouteDetail = {
  routeId: string;
  routeName: string;
  pickupStop: string;
  dropoffStop: string;
};

type StudentWithDetails = User & {
  assignedRoutesDetails: AssignedRouteDetail[];
  routeName?: string;
  assignedRouteNames?: string[];
  feeStatus?: "verified" | "submitted" | "due" | "exempt" | "no_data";
};

type FeePaymentWithFallback = FeePayment & {
  fareAmount?: number;
};

const ITEMS_PER_PAGE = 20;

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [feePayments, setFeePayments] = useState<FeePaymentWithFallback[]>([]);

  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "assigned" | "unassigned" | "fee_due"
  >("all");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "suspended">("pending");
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentWithDetails | null>(
    null,
  );
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Action and Review States
  const [cnicModalOpen, setCnicModalOpen] = useState(false);
  const [userForCnicReview, setUserForCnicReview] = useState<StudentWithDetails | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [actionConfirm, setActionConfirm] = useState<{
    open: boolean;
    type: "approve" | "reject" | "suspend" | "reactivate" | null;
    student: StudentWithDetails | null;
  }>({
    open: false,
    type: null,
    student: null,
  });
  
  const [imageModal, setImageModal] = useState<{
    open: boolean;
    url: string;
  }>({
    open: false,
    url: "",
  });

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
        })) as FeePaymentWithFallback[];
        setFeePayments(payments);
      },
    );
    return () => unsubscribe();
  }, []);

  // TEMPORARY CLEANUP
  useEffect(() => {
    if (students.length === 0 || routes.length === 0) return;
    const runCleanup = async () => {
      let cleaned = false;
      const validStudentIds = new Set(students.map((s) => s.uid));
      for (const route of routes) {
        if (!route.studentIds) continue;
        const validIds = route.studentIds.filter((id) => validStudentIds.has(id));
        if (validIds.length !== route.studentIds.length) {
          console.log(`Cleaning up route ${route.routeName}: removing ${route.studentIds.length - validIds.length} orphaned students`);
          try {
            const { doc, updateDoc } = await import("firebase/firestore");
            await updateDoc(doc(db, COLLECTIONS.ROUTES, route.routeId), {
              studentIds: validIds
            });
            cleaned = true;
          } catch (e) {
            console.error(e);
          }
        }
      }
      if (cleaned) console.log("Database cleanup complete!");
    };
    runCleanup();
  }, [students, routes]);

  // Enrich students with route and fee data
  const enrichedStudents = useMemo(() => {
    const routeFeeById = new Map(
      routes.map((route) => [route.routeId, route.feeAmount || 0]),
    );

    return students.map((student) => {
      const assignedRouteIdsSet = new Set<string>();

      routes.forEach((r) => {
        if (r.studentIds?.includes(student.uid)) {
          assignedRouteIdsSet.add(r.routeId);
        }
      });

      if (typeof student.routeId === "string" && student.routeId) {
        assignedRouteIdsSet.add(student.routeId);
      } else if (Array.isArray((student as any).routeId)) {
        ((student as any).routeId as string[]).forEach((id) => {
          if (id) assignedRouteIdsSet.add(id);
        });
      }

      if (Array.isArray(student.assignedRouteIds)) {
        student.assignedRouteIds.forEach((id) => {
          if (id) assignedRouteIdsSet.add(id);
        });
      }

      if (student.routeStops && typeof student.routeStops === "object") {
        Object.keys(student.routeStops).forEach((id) => {
          if (id) assignedRouteIdsSet.add(id);
        });
      }

      const assignedRoutesList = routes.filter((r) => assignedRouteIdsSet.has(r.routeId));

      const assignedRoutesDetails: AssignedRouteDetail[] = assignedRoutesList.map((route) => {
        let pickup = "-";
        let dropoff = "-";

        if (student.routeStops && student.routeStops[route.routeId]) {
          const rs = student.routeStops[route.routeId] as any;
          pickup = rs.pickupStop || rs.pickup || "-";
          dropoff = rs.dropStop || rs.dropOff || rs.dropoffStop || "-";
        }

        if (pickup === "-" && student.pickupStop && (student.routeId === route.routeId || assignedRoutesList.length === 1)) {
          pickup = student.pickupStop;
        }

        if (dropoff === "-" && (student.dropStop || (student as any).dropoffStop) && (student.routeId === route.routeId || assignedRoutesList.length === 1)) {
          dropoff = student.dropStop || (student as any).dropoffStop;
        }

        return {
          routeId: route.routeId,
          routeName: route.routeName,
          pickupStop: pickup,
          dropoffStop: dropoff,
        };
      });

      const payment = feePayments.find((p) => p.studentId === student.uid);
      const hasPayableRoute = assignedRoutesDetails.some(
        (rDetail) => (routeFeeById.get(rDetail.routeId) || 0) > 0
      );

      let feeStatus: "verified" | "submitted" | "due" | "exempt" | "no_data" =
        "no_data";
      if (payment) {
        if (isFeeExempt(payment)) {
          feeStatus = "exempt";
        } else {
          const normalizedStatus = normalizeFeeStatus(payment.paymentStatus);
          feeStatus =
            normalizedStatus === "verified" ? "verified" : "submitted";
        }
      } else if (!hasPayableRoute) {
        feeStatus = "no_data";
      } else {
        feeStatus = "due";
      }

      return {
        ...student,
        assignedRoutesDetails,
        assignedRouteNames: assignedRoutesDetails.map((r) => r.routeName),
        routeName: assignedRoutesDetails.map((r) => r.routeName).join(", "),
        feeStatus,
      };
    });
  }, [students, routes, feePayments]);

  // Derived state for pending students
  const pendingStudents = useMemo(() => {
    return enrichedStudents.filter((student) => {
      const effectiveStatus = student.status || (student.approved ? "active" : "pending");
      return effectiveStatus === "pending";
    });
  }, [enrichedStudents]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter((student) => {
      const effectiveStatus = student.status || (student.approved ? "active" : "pending");

      // Tab filter
      if (activeTab === "pending") {
        if (effectiveStatus !== "pending") return false;
      } else if (activeTab === "suspended") {
        if (effectiveStatus !== "suspended") return false;
      } else if (activeTab === "approved") {
        if (effectiveStatus !== "approved" && effectiveStatus !== "active") return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          student.fullName?.toLowerCase().includes(term) ||
          student.email?.toLowerCase().includes(term) ||
          student.phone?.toLowerCase().includes(term) ||
          (student.cnicNumber || student.cnic)?.toLowerCase().includes(term) ||
          (student.university || student.universityName || student.instituteName || student.institute || student.college)?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filterStatus === "assigned" && student.assignedRoutesDetails.length === 0) return false;
      if (filterStatus === "unassigned" && student.assignedRoutesDetails.length > 0) return false;
      if (filterStatus === "fee_due" && student.feeStatus !== "due")
        return false;

      return true;
    });
  }, [enrichedStudents, searchTerm, filterStatus, activeTab]);

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = enrichedStudents.length;
    const assigned = enrichedStudents.filter((s) => s.assignedRoutesDetails.length > 0).length;
    const unassigned = total - assigned;
    const feeDue = enrichedStudents.filter((s) => s.feeStatus === "due").length;

    return { total, assigned, unassigned, feeDue };
  }, [enrichedStudents]);

  // CSV Export
  const exportCSV = () => {
    const normalizeCsvText = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      return String(value).replace(/\r?\n|\r/g, " ");
    };

    const forceExcelText = (value: unknown): string => {
      const text = normalizeCsvText(value);
      if (!text) return "";
      // Prefix with tab so Excel keeps values as text (e.g. phone/address-like values).
      return `\t${text}`;
    };

    const escapeCsvCell = (value: unknown): string => {
      const safe = normalizeCsvText(value).replace(/"/g, '""');
      return `"${safe}"`;
    };

    const headers = [
      "Name",
      "Email",
      "Phone",
      "CNIC",
      "University",
      "Route",
      "Pickup Stop",
      "Drop off Stop",
      "Fee Status",
      "Registration Date",
    ];
    const rows = enrichedStudents.map((student) => {
      const routesStr =
        student.assignedRoutesDetails.length > 0
          ? student.assignedRoutesDetails.map((r) => r.routeName).join("; ")
          : "Unassigned";
      const pickupStopsStr =
        student.assignedRoutesDetails.length > 0
          ? student.assignedRoutesDetails.map((r) => r.pickupStop).join("; ")
          : "-";
      const dropoffStopsStr =
        student.assignedRoutesDetails.length > 0
          ? student.assignedRoutesDetails.map((r) => r.dropoffStop).join("; ")
          : "-";

      return [
        normalizeCsvText(student.fullName),
        normalizeCsvText(student.email),
        forceExcelText(student.phone),
        forceExcelText(student.cnicNumber || student.cnic || "-"),
        normalizeCsvText(student.university || student.universityName || student.instituteName || student.institute || student.college || "-"),
        normalizeCsvText(routesStr),
        forceExcelText(pickupStopsStr),
        forceExcelText(dropoffStopsStr),
        normalizeCsvText(student.feeStatus || "-"),
        student.createdAt
          ? forceExcelText(format(student.createdAt.toDate(), "yyyy-MM-dd"))
          : "-",
      ];
    });

    const csv = [
      headers.map((header) => escapeCsvCell(header)).join(","),
      ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
    ].join("\n");

    const csvWithBom = `\uFEFF${csv}`;
    const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
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
      const routeIds = removeTarget.assignedRoutesDetails.map((r) => r.routeId);
      if (routeIds.length > 0) {
        for (const routeId of routeIds) {
          await removeStudentFromRoute(removeTarget.uid, routeId, true);
        }
      } else if (removeTarget.routeId) {
        await removeStudentFromRoute(removeTarget.uid, removeTarget.routeId, true);
      }
      toast.success("Student unassigned from route(s)");
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

  const handleDeleteClick = (student: StudentWithDetails) => {
    setDeleteTarget(student);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeletingStudent(true);
    try {
      await deleteStudentAccount(deleteTarget.uid);
      await resolvePendingRegistrationNotification(deleteTarget.uid);
      toast.success("Student deleted successfully");
      setStudents((prev) => prev.filter((s) => s.uid !== deleteTarget.uid));
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (error: unknown) {
      console.error("Error deleting student:", error);

      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : "";

      if (errorMessage.includes("permission")) {
        toast.error("Permission denied while deleting student records");
      } else {
        toast.error("Failed to delete student");
      }
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleApproveStudent = async (student: StudentWithDetails) => {
    try {
      setActionLoading(true);
      const batch = writeBatch(db);
      const userRef = doc(db, COLLECTIONS.USERS, student.uid);
      batch.update(userRef, {
        approved: true,
        status: "approved",
        approvedAt: serverTimestamp(),
      });
      await batch.commit();
      await resolvePendingRegistrationNotification(student.uid);
      toast.success("Student approved! They can now access the app.");
      setCnicModalOpen(false);
      setUserForCnicReview(null);
    } catch (error) {
      console.error("Error approving student:", error);
      toast.error("Failed to approve student. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectStudent = async (student: StudentWithDetails) => {
    try {
      setActionLoading(true);
      await updateDoc(doc(db, COLLECTIONS.USERS, student.uid), {
        status: "rejected",
        rejectionReason: "Your registration was not approved by the administration.",
        rejectedAt: serverTimestamp(),
      });
      await resolvePendingRegistrationNotification(student.uid);
      setStudents((prev) => prev.filter((s) => s.uid !== student.uid));
      toast.success("Student rejected.");
      setCnicModalOpen(false);
      setUserForCnicReview(null);
    } catch (error) {
      console.error("Error rejecting student:", error);
      toast.error("Failed to reject student");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSuspend = async (student: StudentWithDetails, action: "suspend" | "reactivate") => {
    try {
      setActionLoading(true);
      const newStatus = action === "suspend" ? "suspended" : "active";
      await updateDoc(doc(db, COLLECTIONS.USERS, student.uid), {
        status: newStatus,
      });
      toast.success(`Student ${action === "suspend" ? "suspended" : "reactivated"}`);
    } catch (error) {
      console.error("Error updating student status:", error);
      toast.error("Failed to update student status");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text)]">
              Student Management
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Manage route assignments, fee status, and student records.
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => {
            setActiveTab("pending");
            setCurrentPage(1);
          }}
          className={`px-4 py-3 text-sm font-medium transition relative ${
            activeTab === "pending"
              ? "text-[var(--primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          Pending Approval
          {pendingStudents.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-rose-600 text-white text-xs font-bold">
              {pendingStudents.length}
            </span>
          )}
          {activeTab === "pending" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)]"></div>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("approved");
            setCurrentPage(1);
            setSearchTerm("");
          }}
          className={`px-4 py-3 text-sm font-medium transition relative ${
            activeTab === "approved"
              ? "text-[var(--primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          Approved
          {activeTab === "approved" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)]"></div>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("suspended");
            setCurrentPage(1);
          }}
          className={`px-4 py-3 text-sm font-medium transition relative ${
            activeTab === "suspended"
              ? "text-[var(--primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          Suspended
          {activeTab === "suspended" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)]"></div>
          )}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex gap-3">
          <Search size={20} className="text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or CNIC..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>

        {activeTab === "approved" && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
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
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:opacity-90"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Students List Area */}
      {activeTab === "pending" ? (
        <div className="space-y-6">
          {pendingStudents.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900">
                  {pendingStudents.length} student{pendingStudents.length !== 1 ? "s" : ""} waiting for approval
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  Review pending students below to approve or reject them.
                </p>
              </div>
            </div>
          )}
          
          {paginatedStudents.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No pending students waiting for approval</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {paginatedStudents.map((student) => (
                <StudentCard
                  key={student.uid}
                  student={student}
                  onApprove={() => setActionConfirm({ open: true, type: "approve", student })}
                  onReject={() => setActionConfirm({ open: true, type: "reject", student })}
                  onVerifyCNIC={() => handleDetailClick(student)}
                  onDelete={() => {
                    setDeleteTarget(student);
                    setDeleteConfirmOpen(true);
                  }}
                  onShowImage={(url) => setImageModal({ open: true, url })}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-secondary)]">
            <tr>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[220px]">
                Student
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[250px]">
                Email
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[150px]">
                Phone
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[160px]">
                CNIC
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[180px]">
                University
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[180px]">
                Assigned Route
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[160px]">
                Pickup Stop
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[160px]">
                Drop off Stop
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[130px]">
                Fee Status
              </th>
              <th className="px-6 py-3.5 text-left text-sm font-semibold text-[var(--text)] min-w-[140px]">
                Registered
              </th>
              <th className="px-6 py-3.5 text-center text-sm font-semibold text-[var(--text)] min-w-[180px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {paginatedStudents.map((student) => (
              <tr
                key={student.uid}
                className="hover:bg-[var(--surface-secondary)]"
              >
                <td className="px-6 py-4 whitespace-nowrap min-w-[220px]">
                  <div className="flex items-center gap-3">
                    {student.profileImageUrl ||
                    (student as any).profilePhoto ||
                    (student as any).photoUrl ||
                    (student as any).avatarUrl ||
                    (student as any).profileImage ? (
                      <Image
                        src={
                          student.profileImageUrl ||
                          (student as any).profilePhoto ||
                          (student as any).photoUrl ||
                          (student as any).avatarUrl ||
                          (student as any).profileImage
                        }
                        alt={student.fullName || ""}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200 cursor-pointer hover:opacity-90 transition"
                        onClick={() =>
                          setImageModal({
                            open: true,
                            url:
                              student.profileImageUrl ||
                              (student as any).profilePhoto ||
                              (student as any).photoUrl ||
                              (student as any).avatarUrl ||
                              (student as any).profileImage,
                          })
                        }
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                        {getInitials(student.fullName || "")}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-slate-900">
                        {student.fullName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[250px]">
                  {student.email}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[150px]">
                  {formatDisplayPhone(student.phone || (student as any).phoneNumber)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[160px]">
                  {student.cnicNumber || student.cnic || (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[180px]">
                  {student.university || student.universityName || student.instituteName || student.institute || student.college || (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 min-w-[180px]">
                  {student.assignedRoutesDetails && student.assignedRoutesDetails.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {student.assignedRoutesDetails.map((rDetail) => (
                        <div key={rDetail.routeId} className="h-7 flex items-center">
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100 whitespace-nowrap">
                            {rDetail.routeName}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                      Unassigned
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 min-w-[160px]">
                  {student.assignedRoutesDetails && student.assignedRoutesDetails.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {student.assignedRoutesDetails.map((rDetail) => (
                        <div key={rDetail.routeId} className="h-7 flex items-center text-sm text-slate-700 font-medium whitespace-nowrap">
                          {rDetail.pickupStop || "—"}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 min-w-[160px]">
                  {student.assignedRoutesDetails && student.assignedRoutesDetails.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {student.assignedRoutesDetails.map((rDetail) => (
                        <div key={rDetail.routeId} className="h-7 flex items-center text-sm text-slate-700 font-medium whitespace-nowrap">
                          {rDetail.dropoffStop || "—"}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 min-w-[130px]">
                  <Badge status={student.feeStatus || "no_data"}>
                    {student.feeStatus === "verified"
                      ? "Verified"
                      : student.feeStatus === "exempt"
                        ? "Exempt"
                        : student.feeStatus === "submitted"
                          ? "Submitted"
                          : student.feeStatus === "due"
                            ? "Due"
                            : "No Fee"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap min-w-[140px]">
                  {student.createdAt
                    ? format(student.createdAt.toDate(), "MMM d, yyyy")
                    : "-"}
                </td>
                <td className="px-6 py-4 min-w-[180px]">
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
                    {student.assignedRoutesDetails && student.assignedRoutesDetails.length > 0 && (
                      <button
                        onClick={() => handleRemoveClick(student)}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                        title="Remove from route"
                      >
                        <Unlink2 size={14} />
                        Unassign
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteClick(student)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                      title="Delete student"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
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
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded p-2 hover:bg-[var(--surface-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className="rounded p-2 hover:bg-[var(--surface-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
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
            onDelete={() => {
              setDetailModalOpen(false);
              setDeleteTarget(selectedStudent);
              setDeleteConfirmOpen(true);
            }}
            onApprove={() => {
              setDetailModalOpen(false);
              setActionConfirm({
                open: true,
                type: "approve",
                student: selectedStudent,
              });
            }}
            onReject={() => {
              setDetailModalOpen(false);
              setActionConfirm({
                open: true,
                type: "reject",
                student: selectedStudent,
              });
            }}
            onSuspend={() => {
              setDetailModalOpen(false);
              setActionConfirm({
                open: true,
                type: selectedStudent.status === "suspended" ? "reactivate" : "suspend",
                student: selectedStudent,
              });
            }}
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

      {deleteConfirmOpen && (() => {
        const hasAssignedRoute = Boolean(deleteTarget?.routeId || (deleteTarget?.assignedRouteIds && deleteTarget.assignedRouteIds.length > 0));
        return (
          <ConfirmDialog
            open={deleteConfirmOpen}
            title="Delete Student"
            message={
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to permanently delete <strong>{deleteTarget?.fullName}</strong>?
                {hasAssignedRoute
                  ? " This will permanently delete their account and clear their assigned route and booking records."
                  : " This will permanently remove their registration and account data from the database."}
              </p>
            }
            confirmLabel="Delete"
            onConfirm={handleDeleteConfirm}
            onCancel={() => {
              setDeleteConfirmOpen(false);
              setDeleteTarget(null);
            }}
            destructive
            isLoading={isDeletingStudent}
          />
        );
      })()}

      {/* CNIC Review Modal */}
      {userForCnicReview && (
        <CNICReviewModal
          open={cnicModalOpen}
          onClose={() => {
            setCnicModalOpen(false);
            setUserForCnicReview(null);
          }}
          user={userForCnicReview}
          onApprove={() => handleApproveStudent(userForCnicReview)}
          onReject={() => handleRejectStudent(userForCnicReview)}
          isLoading={actionLoading}
        />
      )}

      {/* Action Confirmation */}
      <ConfirmDialog
        open={actionConfirm.open}
        title={
          actionConfirm.type === "approve" ? "Approve Student" : 
          actionConfirm.type === "reject" ? "Reject Student" :
          actionConfirm.type === "suspend" ? "Suspend Student" :
          "Reactivate Student"
        }
        message={
          actionConfirm.type === "suspend" 
            ? `Are you sure you want to suspend ${actionConfirm.student?.fullName}? They will lose access to the app temporarily.`
            : `Are you sure you want to ${actionConfirm.type} ${actionConfirm.student?.fullName}?`
        }
        onConfirm={async () => {
          if (!actionConfirm.student || !actionConfirm.type) return;
          if (actionConfirm.type === "approve") {
            await handleApproveStudent(actionConfirm.student);
          } else if (actionConfirm.type === "reject") {
            await handleRejectStudent(actionConfirm.student);
          } else if (actionConfirm.type === "suspend" || actionConfirm.type === "reactivate") {
            await handleToggleSuspend(actionConfirm.student, actionConfirm.type);
          }
          setActionConfirm({ open: false, type: null, student: null });
        }}
        onCancel={() => setActionConfirm({ open: false, type: null, student: null })}
        confirmLabel={
          actionConfirm.type === "approve" ? "Approve" :
          actionConfirm.type === "reject" ? "Reject" :
          actionConfirm.type === "suspend" ? "Suspend" :
          "Reactivate"
        }
        destructive={actionConfirm.type === "reject" || actionConfirm.type === "suspend"}
        isLoading={actionLoading}
      />

      {/* Image Modal */}
      <Modal
        open={imageModal.open}
        onClose={() => setImageModal({ open: false, url: "" })}
        title="Profile Photo"
      >
        <div className="relative h-96 w-full">
          <Image
            src={imageModal.url}
            alt="Profile Photo"
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      </Modal>
    </section>
  );
}
