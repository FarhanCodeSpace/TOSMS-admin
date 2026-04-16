"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type StopLocationPreviewMapProps = {
  latitude: number;
  longitude: number;
};

const fixLeafletIcons = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
};

export default function StopLocationPreviewMap({
  latitude,
  longitude,
}: StopLocationPreviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

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
      center: [latitude, longitude],
      zoom: 14,
      dragging: false,
      zoomControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      map,
    );
    L.marker([latitude, longitude]).addTo(map);

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
  }, [latitude, longitude]);

  return (
    <div className="h-20 overflow-hidden rounded-lg border border-slate-200">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
