"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

import type { ActiveTrackingRide } from "@/app/dashboard/tracking/page";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/marker-icon-2x.png",
  iconUrl: "/marker-icon.png",
  shadowUrl: "/marker-shadow.png",
});

type TrackingMapProps = {
  activeRides: ActiveTrackingRide[];
  focusedDriverId: string | null;
  onDriverSelect: any;
  isLoadingInitialData: boolean;
};

const DEFAULT_CENTER: [number, number] = [33.6844, 73.0479];

const ROUTE_PALETTE = [
  "#2563eb",
  "#0f766e",
  "#c2410c",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#15803d",
];

function colorFromRouteId(routeId: string): string {
  let hash = 0;
  for (let i = 0; i < routeId.length; i += 1) {
    hash = (hash << 5) - hash + routeId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % ROUTE_PALETTE.length;
  return ROUTE_PALETTE[index];
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getVehicleMarkerMeta(vehicleType?: ActiveTrackingRide["vehicleType"]) {
  if (vehicleType === "van") {
    return {
      icon: "🚐",
      accent: "#059669",
      accentSoft: "rgba(5,150,105,0.2)",
    };
  }

  return {
    icon: "🚌",
    accent: "#2563eb",
    accentSoft: "rgba(37,99,235,0.2)",
  };
}

function createDriverIcon(
  initials: string,
  vehicleType?: ActiveTrackingRide["vehicleType"],
) {
  const safeInitials = escapeHtml((initials || "DR").slice(0, 2));
  const { icon, accent, accentSoft } = getVehicleMarkerMeta(vehicleType);

  return L.divIcon({
    className: "driver-bus-marker",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-8px);">
      <div style="position:relative;width:48px;height:48px;border-radius:999px;background:radial-gradient(circle at 35% 30%,#1f2937,#0f172a 65%);border:2px solid ${accent};display:flex;align-items:center;justify-content:center;box-shadow:0 12px 24px rgba(2,6,23,0.42),0 0 0 7px ${accentSoft};">
        <span style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.25));">${icon}</span>
        <span style="position:absolute;inset:-5px;border-radius:999px;border:2px solid ${accent};opacity:0.35;"></span>
        <span style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%) rotate(45deg);width:12px;height:12px;background:#0f172a;border-right:2px solid ${accent};border-bottom:2px solid ${accent};"></span>
        <span style="position:absolute;top:-4px;right:-4px;width:11px;height:11px;border-radius:999px;background:#22c55e;border:2px solid #f8fafc;box-shadow:0 0 0 3px rgba(34,197,94,0.22);"></span>
      </div>
      <div style="margin-top:10px;padding:3px 7px;border-radius:999px;background:#ffffff;color:#0f172a;font-size:9px;font-weight:800;line-height:1;letter-spacing:0.04em;box-shadow:0 6px 16px rgba(15,23,42,0.2);border:1px solid #e2e8f0;">${safeInitials}</div>
    </div>`,
    iconSize: [72, 78],
    iconAnchor: [36, 60],
    popupAnchor: [0, -56],
  });
}

function createStopIcon(number: number) {
  return L.divIcon({
    className: "route-stop-marker",
    html: `<div style="width:24px;height:24px;border-radius:999px;background:linear-gradient(180deg,#ffffff,#e2e8f0);border:2px solid #1e293b;color:#0f172a;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,0.22);">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function TrackingMap({
  activeRides,
  focusedDriverId,
  onDriverSelect,
  isLoadingInitialData,
}: TrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  const routeLayerRefs = useRef<Record<string, L.LayerGroup | null>>({});
  const didFitBoundsRef = useRef(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      Object.values(routeLayerRefs.current).forEach((layer) => layer?.remove());
      Object.values(markerRefs.current).forEach((marker) => marker?.remove());
      routeLayerRefs.current = {};
      markerRefs.current = {};
    };
  }, []);

  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer || !hasMounted) return;

    let initRafId: number | null = null;
    let rafId: number | null = null;
    let timeoutId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let tileLayer: L.TileLayer | null = null;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    if ((mapContainer as any)._leaflet_id) {
      delete (mapContainer as any)._leaflet_id;
    }
    mapContainer.innerHTML = "";

    const handleWindowResize = () => {
      mapRef.current?.invalidateSize(false);
    };

    const initializeMap = () => {
      const width = mapContainer.clientWidth;
      const height = mapContainer.clientHeight;

      // Wait for layout to settle before initializing Leaflet.
      if (width === 0 || height === 0) {
        initRafId = requestAnimationFrame(initializeMap);
        return;
      }

      const map = L.map(mapContainer, {
        center: DEFAULT_CENTER,
        zoom: 11,
        dragging: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        boxZoom: true,
        keyboard: true,
        zoomControl: true,
        attributionControl: true,
      });

      mapRef.current = map;

      tileLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "&copy; OpenStreetMap contributors",
        },
      ).addTo(map);

      // Ensure tiles are aligned after initial mount and layout settling.
      rafId = requestAnimationFrame(() => {
        map.invalidateSize(true);
      });
      timeoutId = window.setTimeout(() => {
        map.invalidateSize(true);
      }, 260);

      tileLayer.on("load", () => {
        map.invalidateSize(false);
      });

      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize(false);
      });
      resizeObserver.observe(mapContainer);

      window.addEventListener("resize", handleWindowResize);
    };

    initializeMap();

    return () => {
      if (initRafId) cancelAnimationFrame(initRafId);
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) window.clearTimeout(timeoutId);
      resizeObserver?.disconnect();
      tileLayer?.off("load");
      window.removeEventListener("resize", handleWindowResize);

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if ((mapContainer as any)._leaflet_id) {
        delete (mapContainer as any)._leaflet_id;
      }
      mapContainer.innerHTML = "";
      didFitBoundsRef.current = false;
    };
  }, [hasMounted]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeDriverIds = new Set<string>();
    const activeRouteIds = new Set<string>();
    const boundsPoints: [number, number][] = [];

    activeRides.forEach((ride) => {
      const lat = toNumber(ride.latitude);
      const lng = toNumber(ride.longitude);
      if (!isValidLatLng(lat, lng)) return;

      activeDriverIds.add(ride.driverId);

      const driverIcon = createDriverIcon(
        ride.driverInitials || "DR",
        ride.vehicleType,
      );
      const updatedAtMs = ride.updatedAt?.toDate().getTime() || Date.now();
      const updatedDiffSeconds = Math.max(
        0,
        Math.floor((Date.now() - updatedAtMs) / 1000),
      );
      const popupContent = `
        <div style="font-size:12px;line-height:1.4;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${ride.driverName}</div>
          <div style="color:#334155;">${ride.routeName}</div>
          <div style="color:#334155;">Vehicle: ${ride.vehiclePlate || "N/A"}</div>
          <div style="color:#334155;">Speed: ${Math.max(0, Math.round(ride.speed))} km/h</div>
          <div style="color:#64748b;">Updated ${updatedDiffSeconds} seconds ago</div>
        </div>
      `;

      let marker = markerRefs.current[ride.driverId];
      if (!marker) {
        marker = L.marker([lat, lng], {
          icon: driverIcon,
        }).addTo(map);
        marker.on("click", () => onDriverSelect(ride.driverId));
        markerRefs.current[ride.driverId] = marker;
      } else {
        marker.setLatLng([lat, lng]);
        marker.setIcon(driverIcon);
      }

      marker.bindPopup(popupContent);
      boundsPoints.push([lat, lng]);

      if (ride.routeId && ride.routeStops?.length) {
        activeRouteIds.add(ride.routeId);
        const routeColor = colorFromRouteId(ride.routeId);
        const orderedStops = [...ride.routeStops].sort(
          (a, b) => a.order - b.order,
        );
        const positions: [number, number][] = orderedStops
          .map(
            (stop) =>
              [
                toNumber(stop.coordinates.latitude),
                toNumber(stop.coordinates.longitude),
              ] as [number, number],
          )
          .filter(([stopLat, stopLng]) => isValidLatLng(stopLat, stopLng));

        boundsPoints.push(...positions);

        let routeLayer = routeLayerRefs.current[ride.routeId];
        if (!routeLayer) {
          routeLayer = L.layerGroup().addTo(map);
          routeLayerRefs.current[ride.routeId] = routeLayer;
        }

        routeLayer.clearLayers();

        if (positions.length > 1) {
          L.polyline(positions, {
            color: routeColor,
            weight: 10,
            opacity: 0.16,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(routeLayer);

          L.polyline(positions, {
            color: routeColor,
            weight: 4,
            opacity: 0.95,
            dashArray: "10 8",
            lineCap: "round",
            lineJoin: "round",
          }).addTo(routeLayer);
        }

        positions.forEach((position, index) => {
          L.marker(position, {
            icon: createStopIcon(index + 1),
            interactive: false,
          }).addTo(routeLayer);
        });
      }
    });

    if (!didFitBoundsRef.current && boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [40, 40] });
      didFitBoundsRef.current = true;
    } else if (activeRides.length === 0) {
      map.setView(DEFAULT_CENTER, 11);
    }

    Object.keys(markerRefs.current).forEach((driverId) => {
      if (!activeDriverIds.has(driverId)) {
        markerRefs.current[driverId]?.remove();
        delete markerRefs.current[driverId];
      }
    });

    Object.keys(routeLayerRefs.current).forEach((routeId) => {
      if (!activeRouteIds.has(routeId)) {
        routeLayerRefs.current[routeId]?.remove();
        delete routeLayerRefs.current[routeId];
      }
    });
  }, [activeRides, onDriverSelect]);

  useEffect(() => {
    if (!focusedDriverId || !mapRef.current) return;

    const marker = markerRefs.current[focusedDriverId];
    if (!marker) return;

    const position = marker.getLatLng();
    mapRef.current.flyTo([position.lat, position.lng], 14, {
      animate: true,
      duration: 0.8,
    });
    marker.openPopup();
  }, [focusedDriverId]);

  return (
    <div className="relative h-full w-full">
      {hasMounted ? (
        <div ref={mapContainerRef} className="h-full w-full" />
      ) : (
        <div className="h-full w-full bg-slate-100" />
      )}

      {activeRides.length === 0 ? (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-xs font-semibold text-slate-700 shadow">
          No active rides
        </div>
      ) : null}

      {isLoadingInitialData ? (
        <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
          <div className="w-60 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-2.5 w-full animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-2.5 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-2.5 w-3/5 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
