"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { format } from "date-fns";
import Link from "next/link";
import {
  MapPin,
  Phone,
  User,
  Clock,
  Users,
  Zap,
  ChevronLeft,
  Edit,
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { Route, User as UserType, Availability } from "@/types";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import AssignDriverModal from "./AssignDriverModal";

// Dynamic map component
const RouteMap = ({
  stops,
}: {
  stops: Array<{
    stopName: string;
    order: number;
    coordinates: { latitude: number; longitude: number };
  }>;
}) => {
  useEffect(() => {
    let mapInstance: any = null;

    const loadMap = async () => {
      // Dynamically import leaflet only on client
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      const mapContainer = document.getElementById("map") as HTMLElement;
      if (!mapContainer) return;

      // Remove existing map completely before creating new one
      if ((mapContainer as any)._leaflet_map) {
        (mapContainer as any)._leaflet_map.remove();
      }

      // Clear all leaflet properties
      Object.keys(mapContainer).forEach((key) => {
        if (key.startsWith("_leaflet")) {
          delete (mapContainer as any)[key];
        }
      });
      mapContainer.innerHTML = "";

      mapInstance = L.map(mapContainer).setView(
        [
          stops[0]?.coordinates.latitude || 33.6844,
          stops[0]?.coordinates.longitude || 73.0479,
        ],
        13,
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapInstance);

      const coordinates = stops.map(
        (s) =>
          [s.coordinates.latitude, s.coordinates.longitude] as [number, number],
      );

      // Add markers
      stops.forEach((stop) => {
        L.marker([stop.coordinates.latitude, stop.coordinates.longitude])
          .bindPopup(
            `<div class="p-2"><strong>${stop.order}. ${stop.stopName}</strong><br/>${stop.coordinates.latitude.toFixed(4)}, ${stop.coordinates.longitude.toFixed(4)}</div>`,
          )
          .addTo(mapInstance);
      });

      // Draw polyline
      if (coordinates.length > 1) {
        L.polyline(coordinates, {
          color: "blue",
          weight: 2,
          opacity: 0.7,
        }).addTo(mapInstance);
      }

      // Fit bounds
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates);
        mapInstance.fitBounds(bounds, { padding: [50, 50] });
      }
    };

    loadMap().catch((err) => console.error("Map error:", err));

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [stops]);

  return <div id="map" className="w-full h-96 rounded-lg" />;
};

export default function RouteDetailPage() {
  const params = useParams();
  const routeId = params?.routeId as string;

  const [route, setRoute] = useState<Route | null>(null);
  const [driver, setDriver] = useState<UserType | null>(null);
  const [students, setStudents] = useState<UserType[]>([]);
  const [drivers, setDrivers] = useState<UserType[]>([]);
  const [todayAvailability, setTodayAvailability] = useState<Availability[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const [assignDriverModalOpen, setAssignDriverModalOpen] = useState(false);

  // Fetch route
  useEffect(() => {
    if (!routeId) return;

    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.ROUTES, routeId),
      async (snapshot) => {
        if (snapshot.exists()) {
          const routeData = {
            ...snapshot.data(),
            routeId: snapshot.id,
          } as Route;
          setRoute(routeData);

          // Fetch assigned driver
          if (routeData.assignedDriverId) {
            const driverSnap = await getDoc(
              doc(db, COLLECTIONS.USERS, routeData.assignedDriverId),
            );
            if (driverSnap.exists()) {
              setDriver({
                ...driverSnap.data(),
                uid: driverSnap.id,
              } as UserType);
            }
          }

          // Fetch assigned students
          const studentSnaps = await getDocs(
            query(
              collection(db, COLLECTIONS.USERS),
              where("routeId", "==", routeId),
              where("role", "==", "student"),
            ),
          );
          const studentsList = studentSnaps.docs.map((d) => ({
            ...d.data(),
            uid: d.id,
          })) as UserType[];
          setStudents(studentsList);
        }
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [routeId]);

  // Fetch all drivers
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "driver")),
      (snapshot) => {
        const driversList = snapshot.docs.map((d) => ({
          ...d.data(),
          uid: d.id,
        })) as UserType[];
        setDrivers(driversList);
      },
    );
    return () => unsubscribe();
  }, []);

  // Fetch today's availability
  useEffect(() => {
    if (!routeId) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.AVAILABILITY),
        where("routeId", "==", routeId),
        where("date", "==", today),
      ),
      (snapshot) => {
        const availability = snapshot.docs.map((d) => ({
          ...d.data(),
          availabilityId: d.id,
        })) as Availability[];
        setTodayAvailability(availability);
      },
    );

    return () => unsubscribe();
  }, [routeId]);

  const getTodayAvailability = (studentId: string) => {
    const record = todayAvailability.find((a) => a.userId === studentId);
    return record?.isAvailable ?? null;
  };

  const availabilitySummary = useMemo(() => {
    const available = todayAvailability.filter((a) => a.isAvailable).length;
    const unavailable = todayAvailability.filter((a) => !a.isAvailable).length;
    const notMarked = students.length - available - unavailable;

    return { available, unavailable, notMarked };
  }, [todayAvailability, students]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading route details...</p>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-600 mb-4">Route not found</p>
        <Link
          href="/dashboard/routes"
          className="text-blue-600 hover:underline"
        >
          Back to Routes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/routes"
            className="p-2 hover:bg-slate-100 rounded transition"
          >
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {route.routeName}
            </h1>
            <p className="text-sm text-slate-600">{route.description}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/routes`}
          className="px-4 py-2 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition inline-flex items-center gap-2"
        >
          <Edit size={18} />
          Edit Route
        </Link>
      </div>

      {/* Route Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-slate-600" />
            <span className="text-sm text-slate-600">Schedule</span>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {route.departureTime} - {route.returnTime}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-slate-600" />
            <span className="text-sm text-slate-600">Students</span>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {route.studentIds?.length || 0} / 30
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={18} className="text-slate-600" />
            <span className="text-sm text-slate-600">Stops</span>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {route.stops?.length || 0}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={18} className="text-slate-600" />
            <span className="text-sm text-slate-600">Fee</span>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            PKR {route.feeAmount.toLocaleString("en-PK")}
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Route Map</h2>
        <RouteMap stops={route.stops || []} />
      </div>

      {/* Driver Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Assigned Driver
          </h2>
          <button
            onClick={() => setAssignDriverModalOpen(true)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Change Driver
          </button>
        </div>

        {driver ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
              {(driver.fullName || "").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{driver.fullName}</p>
              <p className="text-sm text-slate-600">{driver.phone}</p>
              <p className="text-xs text-slate-500">
                Vehicle: {driver.vehicleType}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-600">
            <p>No driver assigned</p>
          </div>
        )}
      </div>

      {/* Today's Availability Summary */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Available Today
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {availabilitySummary.available}
            </div>
            <p className="text-sm text-slate-600">Available</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-rose-600">
              {availabilitySummary.unavailable}
            </div>
            <p className="text-sm text-slate-600">Unavailable</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-400">
              {availabilitySummary.notMarked}
            </div>
            <p className="text-sm text-slate-600">Not Marked</p>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">
            Assigned Students ({students.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-200">
          {students.map((student) => {
            const availability = getTodayAvailability(student.uid);
            return (
              <div
                key={student.uid}
                className="px-6 py-4 hover:bg-slate-50 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                    {(student.fullName || "").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {student.fullName}
                    </p>
                    <p className="text-sm text-slate-600">{student.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-600">
                      Pickup Stop
                    </p>
                    <p className="text-slate-900">
                      {student.pickupStop || "-"}
                    </p>
                  </div>
                  <div>
                    {availability === null ? (
                      <Badge status="pending">Not Marked</Badge>
                    ) : availability ? (
                      <Badge status="available">Available</Badge>
                    ) : (
                      <Badge status="unavailable">Unavailable</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {students.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            No students assigned to this route
          </div>
        )}
      </div>

      {/* Modals */}
      <AssignDriverModal
        open={assignDriverModalOpen}
        onClose={() => setAssignDriverModalOpen(false)}
        route={route}
        drivers={drivers}
        currentDriver={driver}
      />
    </div>
  );
}
