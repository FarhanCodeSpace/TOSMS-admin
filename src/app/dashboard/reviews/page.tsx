"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isSameDay, parseISO } from "date-fns";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { AlertTriangle, Car, Calendar, Clock, Users, ChevronDown, ChevronRight, User } from "lucide-react";
import toast from "react-hot-toast";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import StarRating from "@/components/ui/StarRating";
import Badge from "@/components/ui/Badge";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Review, User as UserType, Ride, EarlyRideRequest } from "@/types";
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

export default function ReviewsPage() {
  const [drivers, setDrivers] = useState<UserType[]>([]);
  const [students, setStudents] = useState<UserType[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [earlyRideRequests, setEarlyRideRequests] = useState<EarlyRideRequest[]>([]);
  
  const [expandedRides, setExpandedRides] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const router = useRouter();

  const [driverFilter, setDriverFilter] = useState("all");
  const [rideTypeFilter, setRideTypeFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ReviewRow | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);

    const unsubDrivers = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "driver")),
      (snapshot) => setDrivers(snapshot.docs.map((doc) => ({ ...(doc.data() as UserType), uid: doc.id }))),
      (err) => { console.error(err); setError("Failed to load driver profiles."); setLoading(false); }
    );

    const unsubStudents = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "student")),
      (snapshot) => setStudents(snapshot.docs.map((doc) => ({ ...(doc.data() as UserType), uid: doc.id }))),
      (err) => { console.error(err); }
    );

    const unsubReviews = onSnapshot(
      collection(db, COLLECTIONS.REVIEWS),
      (snapshot) => {
        setReviews(snapshot.docs.map((doc) => {
          const data = doc.data() as Review;
          return { ...data, reviewId: doc.id, driverName: data.driverId };
        }));
      },
      (err) => { console.error(err); }
    );

    const unsubRides = onSnapshot(
      query(collection(db, COLLECTIONS.RIDES), where("status", "==", "completed")),
      (snapshot) => {
        setRides(snapshot.docs.map((doc) => ({ ...(doc.data() as Ride), rideId: doc.id })));
      },
      (err) => { console.error(err); }
    );

    const unsubEarlyRides = onSnapshot(
      collection(db, COLLECTIONS.EARLY_RIDE_REQUESTS),
      (snapshot) => {
        setEarlyRideRequests(snapshot.docs.map((doc) => doc.data() as EarlyRideRequest));
        setLoading(false);
      },
      (err) => { console.error(err); }
    );

    return () => {
      unsubDrivers();
      unsubStudents();
      unsubReviews();
      unsubRides();
      unsubEarlyRides();
    };
  };

  useEffect(() => {
    const unsubscribe = loadData();
    return () => unsubscribe();
  }, [reloadKey]);

  const driversById = useMemo(() => {
    return new Map(drivers.map((driver) => [driver.uid, driver]));
  }, [drivers]);

  const studentsById = useMemo(() => {
    return new Map(students.map((student) => [student.uid, student]));
  }, [students]);

  const hydratedReviews = useMemo(() => {
    return reviews.map((review) => ({
      ...review,
      driverName: driversById.get(review.driverId)?.fullName || review.driverName || "Unknown Driver",
    }));
  }, [reviews, driversById]);

  const driverSummaries = useMemo<DriverSummary[]>(() => {
    const targetDate = startDateFilter ? parseISO(startDateFilter) : new Date();

    return drivers
      .map((driver: UserType) => {
        const driverReviews = hydratedReviews.filter((review: ReviewRow) => review.driverId === driver.uid);
        
        const applicableReviews = driverReviews.filter((review: ReviewRow) => {
          if (!review.createdAt || !review.createdAt.toDate) return false;
          return isSameDay(review.createdAt.toDate(), targetDate);
        });

        const totalReviews = applicableReviews.length;
        const averageRating = totalReviews > 0 ? applicableReviews.reduce((sum: number, review: ReviewRow) => sum + review.rating, 0) / totalReviews : 0;

        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        applicableReviews.forEach((review: ReviewRow) => {
          const rounded = Math.max(1, Math.min(5, Math.round(review.rating)));
          distribution[rounded] += 1;
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
      .sort((a: DriverSummary, b: DriverSummary) => b.averageRating - a.averageRating);
  }, [drivers, hydratedReviews, startDateFilter]);

  const earlyRideIds = useMemo(() => {
    const ids = new Set<string>();
    earlyRideRequests.forEach((req: EarlyRideRequest) => {
      if (req.rideId) ids.add(req.rideId);
    });
    return ids;
  }, [earlyRideRequests]);

  const reviewsByRideAndStudent = useMemo(() => {
    const map = new Map<string, ReviewRow>();
    reviews.forEach((review: ReviewRow) => {
      const key = `${review.rideId}_${review.studentId}`;
      map.set(key, review);
    });
    return map;
  }, [reviews]);

  const processedRides = useMemo(() => {
    type ProcessedRide = Ride & { rideType: string; isEarlyRide: boolean };
    return rides
      .map((ride: Ride): ProcessedRide => {
        const isEarlyRide = earlyRideIds.has(ride.rideId);
        const typeLabel = isEarlyRide ? "Early Ride Sharing" : "Normal Ride";
        return {
          ...ride,
          rideType: typeLabel,
          isEarlyRide
        };
      })
      .filter((ride: ProcessedRide) => {
        const actualDriverId = ride.assignedDriverId;
        if (driverFilter !== "all" && actualDriverId !== driverFilter) return false;
        if (rideTypeFilter !== "all" && ride.rideType !== rideTypeFilter) return false;
        if (startDateFilter && ride.date < startDateFilter) return false;
        if (endDateFilter && ride.date > endDateFilter) return false;
        return true;
      })
      .sort((a: ProcessedRide, b: ProcessedRide) => {
        const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
        if (dateCompare !== 0) return dateCompare;
        return String(b.departureTime || "").localeCompare(String(a.departureTime || ""));
      });
  }, [rides, earlyRideIds, driverFilter, rideTypeFilter, startDateFilter, endDateFilter]);

  const recalculateDriverRating = async (driverId: string) => {
    const driverReviewsSnapshot = await getDocs(
      query(collection(db, COLLECTIONS.REVIEWS), where("driverId", "==", driverId))
    );
    const remaining = driverReviewsSnapshot.docs.map((doc) => doc.data() as Review);
    const average = remaining.length > 0 ? remaining.reduce((sum: number, rev: Review) => sum + rev.rating, 0) / remaining.length : 0;
    await updateDoc(doc(db, COLLECTIONS.USERS, driverId), { rating: Number(average.toFixed(2)) });
  };

  const toggleFlag = async (review: ReviewRow) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.REVIEWS, review.reviewId), { flagged: !review.flagged });
      toast.success(review.flagged ? "Review unflagged successfully" : "Review flagged successfully");
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete review");
    } finally {
      setActionLoading(false);
    }
  };

  if (error) {
    return (
      <ErrorState
        title="Reviews could not be loaded"
        message={error}
        onRetry={() => { setError(null); setReloadKey((prev) => prev + 1); }}
      />
    );
  }

  return (
    <section className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Reviews &amp; Ratings</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Monitor historical completed rides, verify passenger lists, and moderate student feedback.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Driver Ratings Summary</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonLoader key={i} variant="card" />)}
          </div>
        ) : driverSummaries.length === 0 ? (
          <EmptyState icon={<User className="h-7 w-7" />} title="No driver ratings available" subtitle="Summaries will appear after reviews." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {driverSummaries.map((summary) => {
              const selected = driverFilter === summary.driverId;
              return (
                <Link
                  key={summary.driverId}
                  href={`/dashboard/reviews/${summary.driverId}${startDateFilter ? `?date=${startDateFilter}` : ''}`}
                  className={`rounded-2xl border p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 relative ${
                    selected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {summary.profileImageUrl ? (
                      <img src={summary.profileImageUrl} alt={summary.driverName} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                        {getInitials(summary.driverName)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{summary.driverName}</p>
                      <p className="text-xs text-slate-500">{summary.totalReviews} reviews</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <StarRating rating={summary.averageRating} showValue />
                  </div>
                  <div className="mt-3 space-y-1">
                    {[5, 4, 3, 2, 1].map((star: number) => {
                      const count = summary.distribution[star] ?? 0;
                      const percent = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="w-6 text-xs font-medium text-slate-600">{star}★</span>
                          <div className="h-2 flex-1 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="w-5 text-right text-xs text-slate-500">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
