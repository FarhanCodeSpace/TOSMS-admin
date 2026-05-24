"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { eachDayOfInterval, format, isAfter, parseISO } from "date-fns";
import toast from "react-hot-toast";

import Modal from "@/components/ui/Modal";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/firebase";
import type { Route, Ride } from "@/types";
import { getTodayString } from "@/utils/dateHelpers";

type BulkCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
};

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

const DAY_INDEX_TO_KEY: Record<number, DayKey | null> = {
  0: null,
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

const MAX_RANGE_DAYS = 30;
const BATCH_LIMIT = 450;

export default function BulkCreateModal({
  open,
  onClose,
  onCompleted,
}: BulkCreateModalProps) {
  const today = getTodayString();
  const defaultEnd = format(
    new Date(new Date().getTime() + 6 * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd",
  );

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEnd);

  const [daySelection, setDaySelection] = useState<Record<DayKey, boolean>>({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
  });

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);

  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return;

    const loadRoutes = async () => {
      setLoadingRoutes(true);
      try {
        const routeSnap = await getDocs(
          query(
            collection(db, COLLECTIONS.ROUTES),
            where("isActive", "==", true),
          ),
        );

        const activeRoutes = routeSnap.docs.map((routeDoc) => ({
          ...(routeDoc.data() as Route),
          routeId: routeDoc.id,
        }));

        setRoutes(activeRoutes);
        setSelectedRouteIds(activeRoutes.map((route) => route.routeId));
      } catch (error) {
        console.error("Error loading active routes:", error);
        toast.error("Failed to load active routes");
      } finally {
        setLoadingRoutes(false);
      }
    };

    setStartDate(today);
    setEndDate(defaultEnd);
    setDaySelection({
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: false,
    });
    setProgress(0);
    void loadRoutes();
  }, [open]);

  const validRange = useMemo(() => {
    if (!startDate || !endDate) return false;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (isAfter(start, end)) return false;
    const diffDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diffDays <= MAX_RANGE_DAYS;
  }, [startDate, endDate]);

  const selectedDateKeys = useMemo(() => {
    if (!validRange) return [] as string[];

    const intervalDays = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    return intervalDays
      .filter((date) => {
        const dayKey = DAY_INDEX_TO_KEY[date.getDay()];
        if (!dayKey) return false;
        return daySelection[dayKey];
      })
      .map((date) => format(date, "yyyy-MM-dd"));
  }, [daySelection, endDate, startDate, validRange]);

  const preview = useMemo(() => {
    const routeCount = selectedRouteIds.length;
    const rideCount = routeCount * selectedDateKeys.length;
    return { routeCount, rideCount };
  }, [selectedRouteIds, selectedDateKeys.length]);

  const toggleRoute = (routeId: string) => {
    setSelectedRouteIds((previous) =>
      previous.includes(routeId)
        ? previous.filter((id) => id !== routeId)
        : [...previous, routeId],
    );
  };

  const handleBulkCreate = async () => {
    if (!validRange) {
      toast.error("Please select a valid date range up to 30 days");
      return;
    }

    if (selectedDateKeys.length === 0) {
      toast.error("Select at least one day of week in the range");
      return;
    }

    if (selectedRouteIds.length === 0) {
      toast.error("Select at least one route");
      return;
    }

    const selectedRoutes = routes.filter((route) =>
      selectedRouteIds.includes(route.routeId),
    );

    setIsSubmitting(true);
    setProgress(5);

    try {
      const existingSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.RIDES),
          where("date", ">=", startDate),
          where("date", "<=", endDate),
        ),
      );

      const existingKeys = new Set(
        existingSnap.docs.map((rideDoc) => {
          const ride = rideDoc.data() as Ride;
          return `${ride.routeId}__${ride.date}`;
        }),
      );

      const totalCandidates = selectedRoutes.length * selectedDateKeys.length;
      let processed = 0;
      let created = 0;
      let skipped = 0;

      let batch = writeBatch(db);
      let batchCount = 0;

      for (const route of selectedRoutes) {
        for (const date of selectedDateKeys) {
          const key = `${route.routeId}__${date}`;

          if (existingKeys.has(key)) {
            skipped += 1;
          } else {
            const rideRef = doc(collection(db, COLLECTIONS.RIDES));
            batch.set(rideRef, {
              rideId: rideRef.id,
              routeId: route.routeId,
              routeName: route.routeName || "Unnamed Route",
              assignedDriverId: route.assignedDriverId || "",
              driverName: route.assignedDriverName || "Unassigned Driver",
              date,
              departureTime: route.departureTime || "08:00",
              status: "scheduled",
              boardedCount: 0,
              createdAt: serverTimestamp(),
              scheduledAt: serverTimestamp(),
            });
            batchCount += 1;
            created += 1;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }

          processed += 1;
          setProgress(
            Math.max(5, Math.round((processed / totalCandidates) * 100)),
          );
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      setProgress(100);
      toast.success(
        `Bulk create complete: ${created} created, ${skipped} skipped`,
      );
      onCompleted?.();
      onClose();
    } catch (error) {
      console.error("Error bulk creating rides:", error);
      toast.error("Failed to bulk create rides");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk Create Rides"
      isLoading={isSubmitting}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {!validRange ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Date range must be valid and within 30 days.
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Days of Week</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DAY_LABELS) as DayKey[]).map((dayKey) => (
              <label
                key={dayKey}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={daySelection[dayKey]}
                  onChange={(event) =>
                    setDaySelection((previous) => ({
                      ...previous,
                      [dayKey]: event.target.checked,
                    }))
                  }
                  disabled={isSubmitting}
                />
                {DAY_LABELS[dayKey]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Routes</p>
            <button
              type="button"
              disabled={isSubmitting || routes.length === 0}
              onClick={() =>
                setSelectedRouteIds(
                  selectedRouteIds.length === routes.length
                    ? []
                    : routes.map((route) => route.routeId),
                )
              }
              className="text-xs font-semibold text-blue-700"
            >
              {selectedRouteIds.length === routes.length
                ? "Unselect All"
                : "Select All"}
            </button>
          </div>

          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {loadingRoutes ? (
              <p className="text-sm text-slate-500">Loading routes...</p>
            ) : routes.length === 0 ? (
              <p className="text-sm text-slate-500">No active routes found.</p>
            ) : (
              routes.map((route) => (
                <label
                  key={route.routeId}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedRouteIds.includes(route.routeId)}
                    onChange={() => toggleRoute(route.routeId)}
                    disabled={isSubmitting}
                  />
                  <span>
                    {route.routeName} -{" "}
                    {route.assignedDriverName || "No Driver"}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          This will create{" "}
          <span className="font-bold">{preview.rideCount}</span> rides across{" "}
          <span className="font-bold">{preview.routeCount}</span> routes.
        </div>

        {isSubmitting ? (
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Creating rides... {progress}%
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBulkCreate}
            disabled={isSubmitting || !validRange || preview.rideCount === 0}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Rides"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
