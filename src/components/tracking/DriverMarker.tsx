"use client";

import { useEffect, useMemo, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

import type { ActiveTrackingRide } from "@/app/dashboard/tracking/page";

type DriverMarkerProps = {
  ride: ActiveTrackingRide;
  nowMs: number;
  onSelect: any;
  registerMarker: any;
};

function formatSpeed(speed: number): string {
  return `${Math.max(0, Math.round(speed))} km/h`;
}

function formatUpdatedAgo(dateMs: number, nowMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((nowMs - dateMs) / 1000));
  return `Updated ${diffSeconds} seconds ago`;
}

export default function DriverMarker({
  ride,
  nowMs,
  onSelect,
  registerMarker,
}: DriverMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const previousPositionRef = useRef<[number, number]>([
    ride.latitude,
    ride.longitude,
  ]);
  const animationFrameRef = useRef<number | null>(null);

  const driverIcon = useMemo(() => {
    const initials = ride.driverInitials || "DR";

    return L.divIcon({
      className: "driver-bus-marker",
      html: `<div style="display:flex;align-items:center;gap:6px;background:#16324a;color:#fff;border:2px solid #f5a623;border-radius:999px;padding:6px 10px;box-shadow:0 6px 18px rgba(15,23,42,0.35);font-weight:700;font-size:11px;line-height:1;"><span style="font-size:14px">🚌</span><span>${initials}</span></div>`,
      iconSize: [74, 34],
      iconAnchor: [37, 17],
      popupAnchor: [0, -18],
    });
  }, [ride.driverInitials]);

  useEffect(() => {
    registerMarker(ride.driverId, markerRef.current);

    return () => {
      registerMarker(ride.driverId, null);
    };
  }, [ride.driverId, registerMarker]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const [fromLat, fromLng] = previousPositionRef.current;
    const toLat = ride.latitude;
    const toLng = ride.longitude;

    const start = performance.now();
    const duration = 500;

    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const lat = fromLat + (toLat - fromLat) * progress;
      const lng = fromLng + (toLng - fromLng) * progress;

      marker.setLatLng([lat, lng]);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        previousPositionRef.current = [toLat, toLng];
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [ride.latitude, ride.longitude]);

  const updatedAtMs = ride.updatedAt?.toDate().getTime() || nowMs;

  return (
    <Marker
      ref={markerRef}
      position={[ride.latitude, ride.longitude]}
      icon={driverIcon}
      eventHandlers={{
        click: () => onSelect(ride.driverId),
      }}
    >
      <Popup>
        <div className="space-y-1 text-xs">
          <p className="text-sm font-semibold text-slate-900">
            {ride.driverName}
          </p>
          <p className="text-slate-700">{ride.routeName}</p>
          <p className="text-slate-700">
            Vehicle: {ride.vehiclePlate || "N/A"}
          </p>
          <p className="text-slate-700">Speed: {formatSpeed(ride.speed)}</p>
          <p className="text-slate-500">
            {formatUpdatedAgo(updatedAtMs, nowMs)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}
