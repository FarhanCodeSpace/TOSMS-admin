"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import L from "leaflet";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type StopLocationPickerModalProps = {
  open: boolean;
  onClose: () => void;
  initialLocation?: Coordinates;
  // eslint-disable-next-line no-unused-vars
  onConfirm: (...args: [Coordinates]) => void;
};

const PAKISTAN_CENTER: [number, number] = [30.3753, 69.3451];

const fixLeafletIcons = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
};

export default function StopLocationPickerModal({
  open,
  onClose,
  initialLocation,
  onConfirm,
}: StopLocationPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const sessionKeyRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(
    initialLocation || null,
  );

  const updateMarkerPosition = useCallback(
    (latitude: number, longitude: number) => {
      const map = mapRef.current;
      if (!map) return;

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        const marker = L.marker([latitude, longitude], {
          draggable: true,
        }).addTo(map);
        marker.on("dragend", () => {
          const latLng = marker.getLatLng();
          setSelectedLocation({
            latitude: latLng.lat,
            longitude: latLng.lng,
          });
        });
        markerRef.current = marker;
      }

      setSelectedLocation({ latitude, longitude });
    },
    [],
  );

  useEffect(() => {
    if (!open) return;

    setSelectedLocation(initialLocation || null);
    setSearchQuery("");

    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markerRef.current = null;
    if ((mapContainer as any)._leaflet_id) {
      delete (mapContainer as any)._leaflet_id;
    }
    mapContainer.innerHTML = "";

    fixLeafletIcons();

    const map = L.map(mapContainer).setView(
      initialLocation
        ? [initialLocation.latitude, initialLocation.longitude]
        : PAKISTAN_CENTER,
      initialLocation ? 13 : 6,
    );
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    if (initialLocation) {
      updateMarkerPosition(initialLocation.latitude, initialLocation.longitude);
    }

    map.on("click", (event: L.LeafletMouseEvent) => {
      updateMarkerPosition(event.latlng.lat, event.latlng.lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      if ((mapContainer as any)._leaflet_id) {
        delete (mapContainer as any)._leaflet_id;
      }
      mapContainer.innerHTML = "";
    };
  }, [open, initialLocation, updateMarkerPosition]);

  if (!open) return null;

  const handleSearch = async (event?: FormEvent) => {
    if (event) event.preventDefault();

    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      );
      const data = (await response.json()) as Array<{
        lat: string;
        lon: string;
      }>;

      if (!data.length) {
        toast.error("No location found for your search");
        return;
      }

      const result = data[0];
      const latitude = parseFloat(result.lat);
      const longitude = parseFloat(result.lon);
      updateMarkerPosition(latitude, longitude);
      mapRef.current?.setView([latitude, longitude], 13);
    } catch (error) {
      console.error("Error searching location:", error);
      toast.error("Failed to search location");
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      toast.error("Please pick a location on the map first");
      return;
    }
    onConfirm(selectedLocation);
    onClose();
  };

  const handleSearchEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="fixed inset-0 z-[10020] bg-slate-950/70">
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Pick Stop Location
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-200 px-5 py-4">
          <p className="text-sm text-slate-700">
            Click anywhere on the map to set the stop location. Drag the marker
            to adjust.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleSearchEnter}
              placeholder="Search for a city or area..."
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        <div className="flex-1">
          <div
            key={sessionKeyRef.current}
            ref={mapContainerRef}
            className="h-full w-full"
          />
        </div>

        <div className="space-y-3 border-t border-slate-200 px-5 py-4">
          {selectedLocation ? (
            <p className="text-sm text-slate-700">
              Latitude: {selectedLocation.latitude.toFixed(4)}, Longitude:{" "}
              {selectedLocation.longitude.toFixed(4)}
            </p>
          ) : (
            <p className="text-sm text-slate-500">No location selected yet.</p>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
