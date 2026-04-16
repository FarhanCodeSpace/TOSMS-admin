"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type TrackingPoint = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
};

type TrackingMapProps = {
  points: TrackingPoint[];
  center?: [number, number];
  zoom?: number;
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

export default function TrackingMap({
  points,
  center = [33.6844, 73.0479],
  zoom = 12,
}: TrackingMapProps) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const mapCenter: [number, number] = points.length
    ? [points[0].latitude, points[0].longitude]
    : center;

  return (
    <div className="h-80 w-full overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={mapCenter} zoom={zoom} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {points.map((point) => (
          <Marker key={point.id} position={[point.latitude, point.longitude]}>
            <Popup>{point.label || "Tracking Point"}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
