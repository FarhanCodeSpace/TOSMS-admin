"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type StopCoordinates = {
  latitude: number;
  longitude: number;
};

type RouteStop = {
  stopName: string;
  order: number;
  coordinates: StopCoordinates;
};

type RouteDetailMapProps = {
  stops: RouteStop[];
};

const DEFAULT_CENTER: [number, number] = [33.6844, 73.0479];

const fixLeafletIcons = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
};

const createNumberedIcon = (number: number) =>
  L.divIcon({
    className: "",
    html: `<div style="
      background-color: #1A3C5E;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">${number}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

export default function RouteDetailMap({ stops }: RouteDetailMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const validStops = useMemo(
    () =>
      stops.filter(
        (stop) =>
          typeof stop?.coordinates?.latitude === "number" &&
          typeof stop?.coordinates?.longitude === "number",
      ),
    [stops],
  );

  const orderedStops = useMemo(
    () => [...validStops].sort((a, b) => a.order - b.order),
    [validStops],
  );

  const center: [number, number] = useMemo(
    () =>
      orderedStops.length
        ? [
            orderedStops[0].coordinates.latitude,
            orderedStops[0].coordinates.longitude,
          ]
        : DEFAULT_CENTER,
    [orderedStops],
  );

  const positions: [number, number][] = useMemo(
    () =>
      orderedStops.map((stop) => [
        stop.coordinates.latitude,
        stop.coordinates.longitude,
      ]),
    [orderedStops],
  );

  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

    // Defensive cleanup for HMR/StrictMode remounts.
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    if ((mapContainer as any)._leaflet_id) {
      delete (mapContainer as any)._leaflet_id;
    }
    mapContainer.innerHTML = "";

    fixLeafletIcons();

    const map = L.map(mapContainer, {
      center,
      zoom: 13,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    orderedStops.forEach((stop) => {
      L.marker([stop.coordinates.latitude, stop.coordinates.longitude], {
        icon: createNumberedIcon(stop.order),
      })
        .bindPopup(
          `<div><p style="font-weight:600; margin:0;">${stop.stopName}</p><p style="font-size:12px; color:#64748b; margin:2px 0 0 0;">Stop ${stop.order}</p></div>`,
        )
        .addTo(map);
    });

    if (positions.length > 1) {
      L.polyline(positions, {
        color: "#1A3C5E",
        weight: 3,
        dashArray: "5, 10",
      }).addTo(map);
    }

    if (positions.length) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if ((mapContainer as any)._leaflet_id) {
        delete (mapContainer as any)._leaflet_id;
      }
      mapContainer.innerHTML = "";
    };
  }, [center, orderedStops, positions]);

  return (
    <div className="h-96 w-full overflow-hidden rounded-xl">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
