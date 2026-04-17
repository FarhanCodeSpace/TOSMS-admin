"use client";

import { useMemo, useState, useEffect } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { AlertTriangle, Flag, Trash2, User } from "lucide-react";
import toast from "react-hot-toast";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import StarRating from "@/components/ui/StarRating";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Review, User as UserType } from "@/types";
import { formatTimestamp, getInitials } from "@/utils/formatters";

type ReviewRow = Review & {
  reviewId: string;
  driverName: string;
};

type DriverSummary = {
  driverId: string;
  driverName: string;
  profileImageUrl?: string;
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
};

function dateInRange(dateValue: Date, start: string, end: string) {
  if (!start && !end) return true;
  const startDate = start ? new Date(`${start}T00:00:00`) : null;
  const endDate = end ? new Date(`${end}T23:59:59`) : null;
  if (startDate && dateValue < startDate) return false;
  if (endDate && dateValue > endDate) return false;
  return true;
}

export default function ReviewsPage() {
  const [drivers, setDrivers] = useState<UserType[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [expandedComments, setExpandedComments] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [driverFilter, setDriverFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ReviewRow | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);

    const unsubDrivers = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "driver")),
      (snapshot) => {
        const nextDrivers = snapshot.docs.map((driverDoc) => ({
          ...(driverDoc.data() as UserType),
          uid: driverDoc.id,
        }));
        setDrivers(nextDrivers);
      },
      (snapshotError) => {
        console.error("Failed loading drivers:", snapshotError);
        setError("Failed to load driver profiles.");
        setLoading(false);
      },
    );

    const unsubReviews = onSnapshot(
      query(collection(db, COLLECTIONS.REVIEWS), orderBy("createdAt", "desc")),
      (snapshot) => {
        const nextReviews = snapshot.docs.map((reviewDoc) => {
          const data = reviewDoc.data() as Review;
          return {
            ...data,
            reviewId: reviewDoc.id,
            driverName: data.driverId,
          };
        });
        setReviews(nextReviews);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Failed loading reviews:", snapshotError);
        setError("Failed to load reviews.");
        setLoading(false);
      },
    );

    return () => {
      unsubDrivers();
      unsubReviews();
    };
  };

  useEffect(() => {
    const unsubscribe = loadData();
    return () => unsubscribe();
  }, [reloadKey]);

  const driversById = useMemo(() => {
    return new Map(drivers.map((driver) => [driver.uid, driver]));
  }, [drivers]);

  const hydratedReviews = useMemo(() => {
    return reviews.map((review) => ({
      ...review,
      driverName:
        driversById.get(review.driverId)?.fullName ||
        review.driverName ||
        "Unknown Driver",
    }));
  }, [reviews, driversById]);

  const driverSummaries = useMemo<DriverSummary[]>(() => {
    return drivers
      .map((driver) => {
        const driverReviews = hydratedReviews.filter(
          (review) => review.driverId === driver.uid,
        );
        const totalReviews = driverReviews.length;
        const averageRating =
          totalReviews > 0
            ? driverReviews.reduce((sum, review) => sum + review.rating, 0) /
              totalReviews
            : 0;

        const distribution = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };

        driverReviews.forEach((review) => {
          const rounded = Math.max(1, Math.min(5, Math.round(review.rating)));
          distribution[rounded as 1 | 2 | 3 | 4 | 5] += 1;
        });

        return {
          driverId: driver.uid,
          driverName: driver.fullName || "Unnamed Driver",
          profileImageUrl: driver.profileImageUrl,
          averageRating,
          totalReviews,
          distribution,
        };
      })
      .sort((a, b) => b.averageRating - a.averageRating);
  }, [drivers, hydratedReviews]);

  const filteredReviews = useMemo(() => {
    return hydratedReviews.filter((review) => {
      if (driverFilter !== "all" && review.driverId !== driverFilter)
        return false;
      if (ratingFilter !== "all" && review.rating !== Number(ratingFilter))
        return false;
      if (flaggedOnly && review.flagged !== true) return false;

      if (review.createdAt?.toDate) {
        const reviewDate = review.createdAt.toDate();
        if (!dateInRange(reviewDate, startDateFilter, endDateFilter))
          return false;
      }

      return true;
    });
  }, [
    hydratedReviews,
    driverFilter,
    ratingFilter,
    flaggedOnly,
    startDateFilter,
    endDateFilter,
  ]);

  const recalculateDriverRating = async (driverId: string) => {
    const driverReviewsSnapshot = await getDocs(
      query(
        collection(db, COLLECTIONS.REVIEWS),
        where("driverId", "==", driverId),
      ),
    );
    const remaining = driverReviewsSnapshot.docs.map(
      (reviewDoc) => reviewDoc.data() as Review,
    );
    const average =
      remaining.length > 0
        ? remaining.reduce((sum, review) => sum + review.rating, 0) /
          remaining.length
        : 0;

    await updateDoc(doc(db, COLLECTIONS.USERS, driverId), {
      rating: Number(average.toFixed(2)),
    });
  };

  const toggleFlag = async (review: ReviewRow) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.REVIEWS, review.reviewId), {
        flagged: !review.flagged,
      });
      toast.success(
        review.flagged
          ? "Review unflagged successfully"
          : "Review flagged successfully",
      );
    } catch (updateError) {
      console.error("Failed to update flagged status:", updateError);
      toast.error("Failed to update flag status");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteReview = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, COLLECTIONS.REVIEWS, deleteTarget.reviewId));
      await recalculateDriverRating(deleteTarget.driverId);
      toast.success("Review deleted and driver rating updated");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("Failed deleting review:", deleteError);
      toast.error("Failed to delete review");
    } finally {
      setActionLoading(false);
    }
  };

  const tableColumns: DataTableColumn<ReviewRow>[] = [
    {
      key: "student",
      header: "Student Name",
      sortable: true,
      render: (review) => review.studentName,
      sortValue: (review) => review.studentName || "",
    },
    {
      key: "driver",
      header: "Driver Name",
      sortable: true,
      render: (review) => review.driverName,
      sortValue: (review) => review.driverName || "",
    },
    {
      key: "rating",
      header: "Star Rating",
      sortable: true,
      render: (review) => <StarRating rating={review.rating} size={15} />,
      sortValue: (review) => review.rating,
    },
    {
      key: "comment",
      header: "Comment",
      render: (review) => {
        const comment = review.comment || "No comment";
        const expanded = expandedComments[review.reviewId] === true;
        const shouldTruncate = comment.length > 100;
        const shown =
          shouldTruncate && !expanded ? `${comment.slice(0, 100)}...` : comment;

        return (
          <div className="max-w-[360px]">
            <p className="text-sm text-slate-700">{shown}</p>
            {shouldTruncate ? (
              <button
                type="button"
                onClick={() =>
                  setExpandedComments((prev) => ({
                    ...prev,
                    [review.reviewId]: !prev[review.reviewId],
                  }))
                }
                className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                {expanded ? "Show less" : "Expand"}
              </button>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (review) => formatTimestamp(review.createdAt),
      sortValue: (review) => review.createdAt?.toMillis?.() || 0,
    },
    {
      key: "flagged",
      header: "Flagged",
      render: (review) =>
        review.flagged ? (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
            Flagged
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "min-w-[190px]",
      render: (review) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void toggleFlag(review);
            }}
            disabled={actionLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Flag className="h-3 w-3" />
            {review.flagged ? "Unflag" : "Flag"}
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(review)}
            disabled={actionLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <ErrorState
        title="Reviews could not be loaded"
        message={error}
        onRetry={() => {
          setError(null);
          setReloadKey((prev) => prev + 1);
        }}
      />
    );
  }

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Reviews &amp; Ratings
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Monitor student feedback, moderate inappropriate comments, and track
          driver service quality.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Driver Ratings Summary
        </h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonLoader key={index} variant="card" />
            ))}
          </div>
        ) : driverSummaries.length === 0 ? (
          <EmptyState
            icon={<User className="h-7 w-7" />}
            title="No driver ratings available"
            subtitle="Driver review summaries will appear after students submit reviews."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {driverSummaries.map((summary) => {
              const selected = driverFilter === summary.driverId;
              return (
                <button
                  key={summary.driverId}
                  type="button"
                  onClick={() =>
                    setDriverFilter((prev) =>
                      prev === summary.driverId ? "all" : summary.driverId,
                    )
                  }
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {summary.profileImageUrl ? (
                      <img
                        src={summary.profileImageUrl}
                        alt={summary.driverName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                        {getInitials(summary.driverName)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {summary.driverName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {summary.totalReviews} reviews
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <StarRating rating={summary.averageRating} showValue />
                  </div>
                  <div className="mt-3 space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = summary.distribution[star] ?? 0;
                      const percent =
                        summary.totalReviews > 0
                          ? (count / summary.totalReviews) * 100
                          : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="w-6 text-xs font-medium text-slate-600">
                            {star}★
                          </span>
                          <div className="h-2 flex-1 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-amber-400"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="w-5 text-right text-xs text-slate-500">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Driver
            <select
              value={driverFilter}
              onChange={(event) => setDriverFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
            >
              <option value="all">All Drivers</option>
              {drivers.map((driver) => (
                <option key={driver.uid} value={driver.uid}>
                  {driver.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Star Rating
            <select
              value={ratingFilter}
              onChange={(event) => setRatingFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
            >
              <option value="all">All Ratings</option>
              <option value="5">5★</option>
              <option value="4">4★</option>
              <option value="3">3★</option>
              <option value="2">2★</option>
              <option value="1">1★</option>
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Start Date
            <input
              type="date"
              value={startDateFilter}
              onChange={(event) => setStartDateFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            End Date
            <input
              type="date"
              value={endDateFilter}
              onChange={(event) => setEndDateFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 xl:pt-6">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(event) => setFlaggedOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Flagged only
          </label>
        </div>
      </div>

      <DataTable
        data={filteredReviews}
        columns={tableColumns}
        keyExtractor={(review) => review.reviewId}
        loading={loading}
        pageSize={10}
        emptyTitle="No reviews match these filters"
        emptySubtitle="Try changing filters or check again after new feedback is submitted."
        emptyActionLabel="Clear filters"
        onEmptyAction={() => {
          setDriverFilter("all");
          setRatingFilter("all");
          setStartDateFilter("");
          setEndDateFilter("");
          setFlaggedOnly(false);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete review?"
        message="This action permanently removes the review and recalculates the driver's average rating."
        confirmLabel="Delete"
        destructive
        isLoading={actionLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void deleteReview();
        }}
      />

      {actionLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <AlertTriangle className="h-4 w-4" />
          Applying review action...
        </div>
      ) : null}
    </section>
  );
}
