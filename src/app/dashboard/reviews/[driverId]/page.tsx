"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { isSameDay, isBefore, startOfDay } from "date-fns";
import { ArrowLeft, Car, Calendar, MessageSquare, User, Star, Settings } from "lucide-react";

import SkeletonLoader from "@/components/ui/SkeletonLoader";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import StarRating from "@/components/ui/StarRating";
import Badge from "@/components/ui/Badge";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Review, User as UserType, Ride, EarlyRideRequest } from "@/types";
import { formatTimestamp, getInitials, formatTimeTo12Hour } from "@/utils/formatters";

export default function DriverRatingDetailsPage() {
  const params = useParams();
  const driverId = params.driverId as string;
  const [activeTab, setActiveTab] = useState<"all" | "today" | "past">("all");

  const [driver, setDriver] = useState<UserType | null>(null);
  const [reviews, setReviews] = useState<(Review & { reviewId: string })[]>([]);
  const [ridesAssigned, setRidesAssigned] = useState<Ride[]>([]);
  const [ridesDriven, setRidesDriven] = useState<Ride[]>([]);
  const [students, setStudents] = useState<Record<string, UserType>>({});
  const [earlyRideRequests, setEarlyRideRequests] = useState<EarlyRideRequest[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId) return;

    setLoading(true);
    setError(null);

    const unsubDriver = onSnapshot(
      doc(db, COLLECTIONS.USERS, driverId),
      (docSnap) => {
        if (docSnap.exists()) {
          setDriver({ ...(docSnap.data() as UserType), uid: docSnap.id });
        } else {
          setError("Driver not found.");
          setLoading(false);
        }
      },
      (err) => { console.error(err); setError("Failed to load driver profile."); setLoading(false); }
    );

    const unsubReviews = onSnapshot(
      query(collection(db, COLLECTIONS.REVIEWS), where("driverId", "==", driverId)),
      (snapshot) => {
        setReviews(snapshot.docs.map(doc => ({ ...(doc.data() as Review), reviewId: doc.id })));
      },
      (err) => { console.error(err); }
    );

    const unsubRidesAssigned = onSnapshot(
      query(collection(db, COLLECTIONS.RIDES), where("assignedDriverId", "==", driverId)),
      (snapshot) => {
        setRidesAssigned(snapshot.docs.map(doc => ({ ...(doc.data() as Ride), rideId: doc.id })));
      },
      (err) => { console.error(err); }
    );

    const unsubRidesDriven = onSnapshot(
      query(collection(db, COLLECTIONS.RIDES), where("driverId", "==", driverId)),
      (snapshot) => {
        setRidesDriven(snapshot.docs.map(doc => ({ ...(doc.data() as Ride), rideId: doc.id })));
      },
      (err) => { console.error(err); }
    );

    const unsubStudents = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "student")),
      (snapshot) => {
        const studentMap: Record<string, UserType> = {};
        snapshot.docs.forEach(doc => {
          studentMap[doc.id] = { ...(doc.data() as UserType), uid: doc.id };
        });
        setStudents(studentMap);
      },
      (err) => { console.error(err); }
    );

    const unsubEarlyRides = onSnapshot(
      collection(db, COLLECTIONS.EARLY_RIDE_REQUESTS),
      (snapshot) => {
        setEarlyRideRequests(snapshot.docs.map(doc => doc.data() as EarlyRideRequest));
        setLoading(false);
      },
      (err) => { console.error(err); }
    );

    return () => {
      unsubDriver();
      unsubReviews();
      unsubRidesAssigned();
      unsubRidesDriven();
      unsubStudents();
      unsubEarlyRides();
    };
  }, [driverId]);

  const today = new Date();
  const todayReviews = useMemo(() => reviews.filter(r => r.createdAt?.toDate && isSameDay(r.createdAt.toDate(), today)), [reviews]);
  const pastReviews = useMemo(() => reviews.filter(r => r.createdAt?.toDate && isBefore(r.createdAt.toDate(), startOfDay(today))), [reviews]);

  const filteredReviews = useMemo(() => {
    if (activeTab === "today") return todayReviews;
    if (activeTab === "past") return pastReviews;
    return reviews;
  }, [activeTab, reviews, todayReviews, pastReviews]);

  const earlyRidesByRideId = useMemo(() => {
    const map = new Map<string, EarlyRideRequest>();
    earlyRideRequests.forEach(req => {
      if (req.rideId) map.set(req.rideId, req);
    });
    return map;
  }, [earlyRideRequests]);
  
  const ridesById = useMemo(() => {
    const map = new Map<string, Ride>();
    ridesAssigned.forEach(r => map.set(r.rideId, r));
    ridesDriven.forEach(r => map.set(r.rideId, r));
    return map;
  }, [ridesAssigned, ridesDriven]);

  const groupedReviews = useMemo(() => {
    const grouped = new Map<string, typeof filteredReviews>();
    filteredReviews.forEach(review => {
      const arr = grouped.get(review.rideId) || [];
      arr.push(review);
      grouped.set(review.rideId, arr);
    });
    return Array.from(grouped.entries()).map(([rideId, reviewsArr]) => {
      const maxTime = Math.max(...reviewsArr.map(r => r.createdAt?.toMillis() || 0));
      return { rideId, reviews: reviewsArr, maxTime };
    }).sort((a, b) => b.maxTime - a.maxTime);
  }, [filteredReviews]);

  if (error) {
    return (
      <ErrorState
        title="Details could not be loaded"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (loading || !driver) {
    return (
      <section className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8">
        <SkeletonLoader rows={5} />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/reviews" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Review History</h1>
      </div>

      <div className="overflow-hidden rounded-[2rem] bg-[#1a365d] p-6 text-white shadow-md relative">
        <h2 className="text-xs font-bold uppercase tracking-widest text-blue-200/80 mb-1">REVIEW HISTORY</h2>
        <h3 className="text-3xl font-bold mb-2">{driver.fullName}</h3>
        <p className="text-sm text-blue-100 mb-6">Real review documents for your assigned driver.</p>

        <div className="flex items-center gap-3 relative z-10">
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-white/10 py-4 px-2 backdrop-blur-sm border border-white/5">
            <span className="text-2xl font-bold">{reviews.length}</span>
            <span className="text-xs text-blue-200 mt-1">Total</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-white/10 py-4 px-2 backdrop-blur-sm border border-white/5">
            <span className="text-2xl font-bold">{todayReviews.length}</span>
            <span className="text-xs text-blue-200 mt-1">Today</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-white/10 py-4 px-2 backdrop-blur-sm border border-white/5 relative">
            <span className="text-2xl font-bold">{pastReviews.length}</span>
            <span className="text-xs text-blue-200 mt-1">Past</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex-1 rounded-full py-3 text-sm font-bold transition ${activeTab === "all" ? "bg-[#1f2937] text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("today")}
          className={`flex-1 rounded-full py-3 text-sm font-bold transition ${activeTab === "today" ? "bg-[#1f2937] text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
        >
          Today
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`flex-1 rounded-full py-3 text-sm font-bold transition ${activeTab === "past" ? "bg-[#1f2937] text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
        >
          Past
        </button>
      </div>

      <div className="space-y-4 pb-10">
        {groupedReviews.length === 0 ? (
          <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="No reviews found" subtitle="There are no reviews for this selected tab." />
        ) : (
          groupedReviews.map(group => {
            const { rideId, reviews: rideReviews } = group;
            const ride = ridesById.get(rideId);
            const earlyRide = earlyRidesByRideId.get(rideId);
            const isEarlyRide = !!earlyRide;
            const displayRouteName = ride?.routeName || earlyRide?.route || "Unknown Route";

            return (
              <div key={rideId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm mb-4">
                <div className="flex items-center justify-between px-6 pt-5 pb-2">
                  <h3 className="text-xl font-bold text-slate-900">{displayRouteName}</h3>
                  <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isEarlyRide ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800" : "bg-emerald-100 text-emerald-700"}`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${isEarlyRide ? "bg-green-500" : "bg-emerald-500"}`}></div>
                    {isEarlyRide ? "Early Ride" : "Normal Ride"}
                  </div>
                </div>
                
                <div className="px-6 pb-4 border-b border-slate-100">
                  <p className="text-sm font-bold text-blue-900">{typeof ride?.date === 'string' ? ride.date : formatTimestamp(ride?.date as any)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEarlyRide 
                      ? `Created: ${formatTimeTo12Hour(earlyRide.createdAt)}` 
                      : (
                          [
                            ride?.departureTime ? `Departure: ${formatTimeTo12Hour(ride.departureTime)}` : null,
                            ride?.returnTime ? `Return: ${formatTimeTo12Hour(ride.returnTime)}` : null
                          ].filter(Boolean).join(" • ") || "N/A"
                        )
                    }
                  </p>
                </div>

                <div className="px-6 py-2">
                  {rideReviews.map(review => {
                    const studentName = students[review.studentId]?.fullName || review.studentName || "Unknown Student";
                    const comment = review.comment || (review as any).feedback || (review as any).text || (review as any).review || (review as any).reviewText || "No comment provided";
                    return (
                      <div key={review.reviewId} className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-2 shadow-sm cursor-default grid grid-cols-3 items-center gap-4">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="text-sm font-semibold text-slate-800 truncate">{studentName}</span>
                        </div>
                        
                        <div className="text-center">
                          <span className="text-sm text-slate-600 italic">"{comment}"</span>
                        </div>

                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-sm font-bold text-slate-800">{review.rating.toFixed(1)}</span>
                          <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

    </section>
  );
}
