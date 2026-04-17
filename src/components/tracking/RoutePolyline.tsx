"use client";

import { useMemo } from "react";
import { Marker, Polyline } from "react-leaflet";
import L from "leaflet";

import type { RouteStop } from "@/types";

type RoutePolylineProps = {
  routeId: string;
  routeName: string;
  stops: RouteStop[];
};

export default function RoutePolyline({
  routeId,
  routeName,
  stops,
}: RoutePolylineProps) {
  const points = useMemo(
    () =>
      (stops || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(
          (stop) =>
            [stop.coordinates.latitude, stop.coordinates.longitude] as [
              number,
              number,
            ],
        ),
    [stops],
  );

  if (points.length === 0) return null;

  return (
    <>
      <Polyline
        positions={points}
        pathOptions={{
          color: "#64748b",
          weight: 3,
          opacity: 0.7,
          dashArray: "8 8",
        }}
      />

      {points.map((position, index) => {
        const stopIcon = L.divIcon({
          className: "route-stop-marker",
          html: `<div style="width:22px;height:22px;border-radius:999px;background:#ffffff;border:2px solid #64748b;color:#334155;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${index + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        return (
          <Marker
            key={`${routeId}_${index}`}
            position={position}
            icon={stopIcon}
            title={`${routeName} stop ${index + 1}`}
          />
        );
      })}
    </>
  );
}
