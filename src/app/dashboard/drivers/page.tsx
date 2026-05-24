"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { Users, AlertCircle, Search, Loader2 } from "lucide-react";
import { Download } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import type { User, Route } from "@/types";
import { useAuth } from "@/context/AuthContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import DriverCard from "@/components/drivers/DriverCard";
import DriverTable from "@/components/drivers/DriverTable";
import DriverDetailModal from "@/components/drivers/DriverDetailModal";
import AssignDriverModal from "@/components/routes/AssignDriverModal";
import { deleteDriverAccount } from "@/utils/firestoreHelpers";

type TabType = "all" | "pending" | "approved" | "suspended";

export default function DriversPage() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [allDrivers, setAllDrivers] = useState<User[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<User[]>([]);
  const [suspendedDrivers, setSuspendedDrivers] = useState<User[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<
    "all" | "van" | "bus" | "coaster"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [driverForRouteAssign, setDriverForRouteAssign] = useState<User | null>(
    null,
  );
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [assignModalRoute, setAssignModalRoute] = useState<Route | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "approve" | "reject" | "suspend" | "reactivate" | "delete" | null;
    driver: User | null;
    reason?: string;
  }>({
    open: false,
    type: null,
    driver: null,
  });
  const [imageModal, setImageModal] = useState<{
    open: boolean;
    url: string;
  }>({
    open: false,
    url: "",
  });

  const itemsPerPage = 15;
  const hasAutoSwitchedTab = useRef(false);

  // Fetch routes
  useEffect(() => {
    if (!currentUser) return;

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
  }, [currentUser]);

  // Fetch all drivers
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "driver")),
      (snapshot) => {
        const drivers = snapshot.docs.map((doc) => doc.data() as User);

        // Categorize drivers
        const pending = drivers.filter(
          (d) =>
            (d.approved === false || d.approved === undefined) &&
            d.profileComplete === true,
        );
        const suspended = drivers.filter((d) => d.status === "suspended");

        setAllDrivers(drivers);
        setPendingDrivers(pending);
        setSuspendedDrivers(suspended);
        setLoading(false);

        // Set default tab to pending if there are pending drivers (only on first load)
        if (pending.length > 0 && !hasAutoSwitchedTab.current) {
          setActiveTab("pending");
          hasAutoSwitchedTab.current = true;
        }
      },
      (error) => {
        console.error("Drivers onSnapshot error:", error);
        if (error.code === "permission-denied") {
          toast.error("Permission denied: Check Firestore rules");
        } else {
          toast.error("Failed to fetch drivers");
        }
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Calculate filtered results
  const filteredDrivers = useMemo(() => {
    let filtered = allDrivers.filter(
      (d) => d.approved === true && d.status !== "suspended",
    );

    if (activeTab === "suspended") {
      filtered = suspendedDrivers;
    } else if (activeTab === "pending") {
      filtered = pendingDrivers;
    } else if (activeTab === "all") {
      filtered = allDrivers;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          (d.fullName?.toLowerCase().includes(term) ?? false) ||
          (d.email?.toLowerCase().includes(term) ?? false) ||
          (d.vehiclePlate?.toLowerCase().includes(term) ?? false),
      );
    }

    if (vehicleFilter !== "all") {
      filtered = filtered.filter((d) => d.vehicleType === vehicleFilter);
    }

    return filtered;
  }, [
    allDrivers,
    pendingDrivers,
    suspendedDrivers,
    activeTab,
    searchTerm,
    vehicleFilter,
  ]);

  const paginatedDrivers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDrivers.slice(start, start + itemsPerPage);
  }, [filteredDrivers, currentPage]);

  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);

  // Handle approve driver
  const handleApproveDriver = async (driver: User) => {
    try {
      setActionLoading(true);
      const batch = writeBatch(db);

      // Update user document
      const userRef = doc(db, COLLECTIONS.USERS, driver.uid);
      batch.update(userRef, {
        approved: true,
        status: "active",
        approvedAt: serverTimestamp(),
      });

      await batch.commit();
      toast.success("Driver approved! They can now access the app.");
      setConfirmDialog({ open: false, type: null, driver: null });
    } catch (error) {
      console.error("Error approving driver:", error);
      toast.error("Failed to approve driver. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle reject driver
  const handleRejectDriver = async (driver: User, reason: string) => {
    try {
      setActionLoading(true);
      await updateDoc(doc(db, COLLECTIONS.USERS, driver.uid), {
        status: "suspended",
        approved: false,
      });
      toast.success(`Driver rejected. Reason: ${reason}`);
      setConfirmDialog({ open: false, type: null, driver: null });
    } catch (error) {
      console.error("Error rejecting driver:", error);
      toast.error("Failed to reject driver");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle suspend/reactivate driver
  const handleToggleSuspend = async (
    driver: User,
    action: "suspend" | "reactivate",
  ) => {
    try {
      setActionLoading(true);
      const newStatus = action === "suspend" ? "suspended" : "active";
      await updateDoc(doc(db, COLLECTIONS.USERS, driver.uid), {
        status: newStatus,
      });
      toast.success(
        `Driver ${action === "suspend" ? "suspended" : "reactivated"}`,
      );
      setConfirmDialog({ open: false, type: null, driver: null });
      setDetailModalOpen(false);
    } catch (error) {
      console.error("Error updating driver status:", error);
      toast.error("Failed to update driver status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    const normalizeCsvText = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      // Keep leading characters (like tab prefix) so Excel text-forcing remains intact.
      return String(value).replace(/\r?\n|\r/g, " ");
    };

    const forceExcelText = (value: unknown): string => {
      const text = normalizeCsvText(value);
      if (!text) return "";
      // Prefix with tab so Excel keeps the original value (e.g. phone numbers).
      return `\t${text}`;
    };

    const escapeCsvCell = (value: unknown): string => {
      const safe = normalizeCsvText(value).replace(/"/g, '""');
      return `"${safe}"`;
    };

    const routeNameByDriverId = new Map<string, string>();
    routes.forEach((route) => {
      if (route.assignedDriverId) {
        routeNameByDriverId.set(route.assignedDriverId, route.routeName);
      }
    });

    const headers = [
      "Name",
      "Email",
      "Phone",
      "Vehicle Type",
      "Vehicle Plate",
      "Vehicle Capacity",
      "Status",
      "Assigned Route",
    ];

    const rows = allDrivers.map((driver) => [
      normalizeCsvText(driver.fullName),
      normalizeCsvText(driver.email),
      forceExcelText(driver.phone),
      normalizeCsvText(driver.vehicleType),
      normalizeCsvText(driver.vehiclePlate),
      forceExcelText(driver.vehicleCapacity),
      normalizeCsvText(driver.status),
      normalizeCsvText(routeNameByDriverId.get(driver.uid) || "Unassigned"),
    ]);

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
      `drivers-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  };

  const handleViewDriver = (driver: User) => {
    setSelectedDriver(driver);
    setDetailModalOpen(true);
  };

  const handleShowImage = (imageUrl: string) => {
    setImageModal({ open: true, url: imageUrl });
  };

  const handleDeleteDriver = async (driver: User) => {
    try {
      setActionLoading(true);
      await deleteDriverAccount(driver.uid);
      toast.success("Driver deleted successfully");
      setConfirmDialog({ open: false, type: null, driver: null });
      setDetailModalOpen(false);
      setSelectedDriver(null);
    } catch (error) {
      console.error("Error deleting driver:", error);
      toast.error("Failed to delete driver");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignRouteClick = (driver: User) => {
    setDriverForRouteAssign(driver);

    const currentRoute =
      routes.find((r) => r.assignedDriverId === driver.uid) ||
      (driver.routeId
        ? routes.find((r) => r.routeId === driver.routeId)
        : null);

    if (routes.length === 0) {
      toast.error("No routes available for assignment");
      return;
    }

    setSelectedRouteId(currentRoute?.routeId || routes[0].routeId);
    setRoutePickerOpen(true);
  };

  const handleOpenAssignModalFromPicker = () => {
    const selectedRoute = routes.find((r) => r.routeId === selectedRouteId);
    if (!selectedRoute) {
      toast.error("Please select a route first");
      return;
    }
    setRoutePickerOpen(false);
    setAssignModalRoute(selectedRoute);
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="space-y-4 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
          </div>
          <SkeletonLoader variant="table" rows={6} />
        </div>
      );
    }

    switch (activeTab) {
      case "pending":
        return (
          <div className="space-y-6">
            {pendingDrivers.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900">
                    {pendingDrivers.length} driver
                    {pendingDrivers.length !== 1 ? "s" : ""} waiting for
                    approval
                  </h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Review pending drivers below to approve or reject them.
                  </p>
                </div>
              </div>
            )}
            {pendingDrivers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">
                  No pending drivers waiting for approval
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingDrivers.map((driver) => (
                  <DriverCard
                    key={driver.uid}
                    driver={driver}
                    onApprove={() => {
                      setConfirmDialog({
                        open: true,
                        type: "approve",
                        driver,
                      });
                    }}
                    onReject={() => {
                      setConfirmDialog({
                        open: true,
                        type: "reject",
                        driver,
                      });
                    }}
                    onDelete={() => {
                      setConfirmDialog({
                        open: true,
                        type: "delete",
                        driver,
                      });
                    }}
                    onShowImage={handleShowImage}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case "approved":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or plate..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <select
                value={vehicleFilter}
                onChange={(e) => {
                  setVehicleFilter(
                    e.target.value as "all" | "van" | "bus" | "coaster",
                  );
                  setCurrentPage(1);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Vehicles</option>
                <option value="van">Van</option>
                <option value="bus">Bus</option>
                <option value="coaster">Coaster</option>
              </select>
            </div>

            {filteredDrivers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No approved drivers found</p>
              </div>
            ) : (
              <>
                <DriverTable
                  drivers={paginatedDrivers}
                  routes={routes}
                  onViewDriver={handleViewDriver}
                  onAssignRoute={handleAssignRouteClick}
                  onSuspend={(driver) => {
                    setConfirmDialog({
                      open: true,
                      type: "suspend",
                      driver,
                    });
                  }}
                  onDelete={(driver) => {
                    setConfirmDialog({
                      open: true,
                      type: "delete",
                      driver,
                    });
                  }}
                />

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-600">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        filteredDrivers.length,
                      )}{" "}
                      of {filteredDrivers.length} drivers
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 rounded-lg text-sm ${
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
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case "suspended":
        return (
          <div className="space-y-4">
            {suspendedDrivers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No suspended drivers</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                        Vehicle
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspendedDrivers.map((driver) => (
                      <tr
                        key={driver.uid}
                        className="border-b border-slate-200 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {driver.fullName}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {driver.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {driver.vehicleType} ({driver.vehiclePlate})
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  open: true,
                                  type: "reactivate",
                                  driver,
                                });
                              }}
                              className="text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                              Reactivate
                            </button>
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  open: true,
                                  type: "delete",
                                  driver,
                                });
                              }}
                              className="text-rose-600 hover:text-rose-700 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            Driver Management
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Manage your driver fleet, approvals, and assignments.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Download size={18} />
          Export CSV
        </button>
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
          {pendingDrivers.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-rose-600 text-white text-xs font-bold">
              {pendingDrivers.length}
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
            setVehicleFilter("all");
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

      {/* Tab Content */}
      {renderTabContent()}

      {/* Confirm Dialog for Actions */}
      {confirmDialog.type === "approve" && confirmDialog.driver && (
        <ConfirmDialog
          open={confirmDialog.open}
          title="Approve Driver?"
          message={`Approve ${confirmDialog.driver.fullName} as a driver? They will be able to access the mobile app.`}
          confirmLabel="Approve"
          isLoading={actionLoading}
          onConfirm={() => handleApproveDriver(confirmDialog.driver as User)}
          onCancel={() =>
            setConfirmDialog({ open: false, type: null, driver: null })
          }
        />
      )}

      {confirmDialog.type === "reject" && confirmDialog.driver && (
        <RejectDialog
          open={confirmDialog.open}
          driver={confirmDialog.driver}
          isLoading={actionLoading}
          onConfirm={(reason) =>
            handleRejectDriver(confirmDialog.driver as User, reason)
          }
          onCancel={() =>
            setConfirmDialog({ open: false, type: null, driver: null })
          }
        />
      )}

      {confirmDialog.type === "suspend" && confirmDialog.driver && (
        <ConfirmDialog
          open={confirmDialog.open}
          title="Suspend Driver?"
          message={`Suspend ${confirmDialog.driver.fullName}? They will not be able to access the mobile app.`}
          confirmLabel="Suspend"
          destructive
          isLoading={actionLoading}
          onConfirm={() => {
            handleToggleSuspend(confirmDialog.driver as User, "suspend");
          }}
          onCancel={() =>
            setConfirmDialog({ open: false, type: null, driver: null })
          }
        />
      )}

      {confirmDialog.type === "reactivate" && confirmDialog.driver && (
        <ConfirmDialog
          open={confirmDialog.open}
          title="Reactivate Driver?"
          message={`Reactivate ${confirmDialog.driver.fullName}? They will regain access to the mobile app.`}
          confirmLabel="Reactivate"
          isLoading={actionLoading}
          onConfirm={() => {
            handleToggleSuspend(confirmDialog.driver as User, "reactivate");
          }}
          onCancel={() =>
            setConfirmDialog({ open: false, type: null, driver: null })
          }
        />
      )}

      {confirmDialog.type === "delete" && confirmDialog.driver && (
        <ConfirmDialog
          open={confirmDialog.open}
          title="Delete Driver?"
          message={`Delete ${confirmDialog.driver.fullName}? This will remove their account and clear assigned route/ride references.`}
          confirmLabel="Delete"
          destructive
          isLoading={actionLoading}
          onConfirm={() => {
            handleDeleteDriver(confirmDialog.driver as User);
          }}
          onCancel={() =>
            setConfirmDialog({ open: false, type: null, driver: null })
          }
        />
      )}

      {/* Detail Modal */}
      {selectedDriver && (
        <DriverDetailModal
          open={detailModalOpen}
          driver={selectedDriver}
          routes={routes}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedDriver(null);
          }}
          onSuspend={() => {
            setDetailModalOpen(false);
            setConfirmDialog({
              open: true,
              type:
                selectedDriver.status === "active" ? "suspend" : "reactivate",
              driver: selectedDriver,
            });
          }}
          onDelete={() => {
            setDetailModalOpen(false);
            setConfirmDialog({
              open: true,
              type: "delete",
              driver: selectedDriver,
            });
          }}
        />
      )}

      {/* Image Modal */}
      <Modal
        open={imageModal.open}
        onClose={() => setImageModal({ open: false, url: "" })}
        title="Profile Photo"
      >
        <div className="flex justify-center">
          <Image
            src={imageModal.url}
            alt="Driver profile"
            width={800}
            height={800}
            unoptimized
            className="max-w-full h-auto max-h-96 rounded-lg"
          />
        </div>
      </Modal>

      <Modal
        open={routePickerOpen}
        onClose={() => setRoutePickerOpen(false)}
        title={`Assign Route to ${driverForRouteAssign?.fullName || "Driver"}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Select a route, then continue to assign or change this driver using
            the route assignment modal.
          </p>
          <select
            value={selectedRouteId}
            onChange={(event) => setSelectedRouteId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-500"
          >
            {routes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.routeName}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setRoutePickerOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOpenAssignModalFromPicker}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      </Modal>

      {assignModalRoute && driverForRouteAssign && (
        <AssignDriverModal
          open={!!assignModalRoute}
          onClose={() => {
            setAssignModalRoute(null);
            setDriverForRouteAssign(null);
          }}
          route={assignModalRoute}
          initialDriverId={driverForRouteAssign.uid}
        />
      )}
    </section>
  );
}

// Reject dialog component
function RejectDialog({
  open,
  driver,
  onConfirm,
  onCancel,
  isLoading = false,
}: {
  open: boolean;
  driver: User;
  // eslint-disable-next-line no-unused-vars
  onConfirm: (...args: [string]) => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Reject Driver"
      isLoading={isLoading}
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason || "No reason provided")}
            disabled={!reason.trim() || isLoading}
            className={`rounded-lg bg-rose-600 px-6 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center transition-all ${
              isLoading ? "ring-2 ring-rose-400 animate-pulse" : ""
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Rejecting...</span>
              </>
            ) : (
              "Reject"
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Reject {driver.fullName} as a driver. Please provide a reason for
          rejection.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for rejection..."
          disabled={isLoading}
          className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          rows={4}
        />
      </div>
    </Modal>
  );
}
