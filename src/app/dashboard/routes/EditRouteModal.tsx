"use client";

import { DragEvent, useState } from "react";
import dynamic from "next/dynamic";
import { doc, updateDoc } from "firebase/firestore";
import { Plus, Trash2, GripVertical, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { Route } from "@/types";

const StopLocationPickerModal = dynamic(
  () => import("@/components/routes/StopLocationPickerModal"),
  { ssr: false },
);

const StopLocationPreviewMap = dynamic(
  () => import("@/components/routes/StopLocationPreviewMap"),
  { ssr: false },
);

type Stop = {
  id: string;
  stopName: string;
  order: number;
  latitude: string;
  longitude: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

const createStopId = (order: number, latitude?: string, longitude?: string) =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${order}-${latitude || ""}-${longitude || ""}-${Math.random().toString(36).slice(2)}`;

type EditRouteModalProps = {
  open: boolean;
  onClose: () => void;
  route: Route;
};

export default function EditRouteModal({
  open,
  onClose,
  route,
}: EditRouteModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Basic Info
  const [routeName, setRouteName] = useState(route.routeName);
  const [description, setDescription] = useState(route.description || "");
  const [departureTime, setDepartureTime] = useState(route.departureTime);
  const [returnTime, setReturnTime] = useState(route.returnTime);
  const [monthlyFee, setMonthlyFee] = useState(route.feeAmount.toString());

  // Stops
  const [stops, setStops] = useState<Stop[]>(
    route.stops?.map((s) => ({
      id: createStopId(
        s.order,
        s.coordinates.latitude.toString(),
        s.coordinates.longitude.toString(),
      ),
      stopName: s.stopName,
      order: s.order,
      latitude: s.coordinates.latitude.toString(),
      longitude: s.coordinates.longitude.toString(),
    })) || [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStopIndex, setPickerStopIndex] = useState<number | null>(null);

  const handleAddStop = () => {
    setStops([
      ...stops,
      {
        id: createStopId(stops.length + 1),
        stopName: "",
        order: stops.length + 1,
        latitude: "",
        longitude: "",
      },
    ]);
  };

  const handleRemoveStop = (index: number) => {
    if (stops.length <= 2) {
      toast.error("Minimum 2 stops required");
      return;
    }
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleStopChange = (
    index: number,
    field: keyof Stop,
    value: string,
  ) => {
    const newStops = [...stops];
    newStops[index] = { ...newStops[index], [field]: value };
    setStops(newStops);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null) return;
    const newStops = [...stops];
    const draggedStop = newStops[draggedIndex];
    newStops.splice(draggedIndex, 1);
    newStops.splice(targetIndex, 0, draggedStop);
    setStops(newStops.map((s, i) => ({ ...s, order: i + 1 })));
    setDraggedIndex(null);
  };

  const openStopPicker = (index: number) => {
    setPickerStopIndex(index);
    setPickerOpen(true);
  };

  const handleStopLocationConfirm = (location: Coordinates) => {
    if (pickerStopIndex === null) return;

    const nextStops = [...stops];
    nextStops[pickerStopIndex] = {
      ...nextStops[pickerStopIndex],
      latitude: location.latitude.toFixed(6),
      longitude: location.longitude.toFixed(6),
    };
    setStops(nextStops);
  };

  const handleSubmit = async () => {
    // Validate
    if (!routeName.trim() || !departureTime || !returnTime || !monthlyFee) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (stops.length < 2) {
      toast.error("Minimum 2 stops required");
      return;
    }

    if (stops.some((s) => !s.stopName.trim() || !s.latitude || !s.longitude)) {
      toast.error("Please fill in all stop details");
      return;
    }

    setIsLoading(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.ROUTES, route.routeId), {
        routeName,
        name: routeName,
        description,
        departureTime,
        returnTime,
        feeAmount: parseInt(monthlyFee),
        stops: stops.map((s) => ({
          stopName: s.stopName,
          order: s.order,
          coordinates: {
            latitude: parseFloat(s.latitude),
            longitude: parseFloat(s.longitude),
          },
        })),
      });

      toast.success("Route updated successfully");
      onClose();
    } catch (error) {
      console.error("Error updating route:", error);
      toast.error("Failed to update route");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Route - ${route.routeName}`}
      isLoading={isLoading}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Route Name *
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Departure Time *
              </label>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Return Time *
              </label>
              <input
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Monthly Fee (PKR) *
            </label>
            <input
              type="number"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Stops */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Stops</h3>
          <div className="space-y-3">
            {stops.map((stop, index) => (
              <div
                key={stop.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index)}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-sm transition cursor-move"
              >
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical size={16} className="text-slate-400" />
                  <span className="text-sm font-semibold text-slate-600">
                    Stop #{stop.order}
                  </span>
                  {stops.length > 2 && (
                    <button
                      onClick={() => handleRemoveStop(index)}
                      className="ml-auto p-1 hover:bg-rose-50 rounded transition"
                    >
                      <Trash2 size={16} className="text-rose-600" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={stop.stopName}
                    onChange={(e) =>
                      handleStopChange(index, "stopName", e.target.value)
                    }
                    placeholder="Stop name"
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={stop.latitude}
                      onChange={(e) =>
                        handleStopChange(index, "latitude", e.target.value)
                      }
                      placeholder="Latitude"
                      step="0.0001"
                      className="px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    />
                    <input
                      type="number"
                      value={stop.longitude}
                      onChange={(e) =>
                        handleStopChange(index, "longitude", e.target.value)
                      }
                      placeholder="Longitude"
                      step="0.0001"
                      className="px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => openStopPicker(index)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-slate-50"
                  >
                    <MapPin size={14} />
                    Pick on Map
                  </button>

                  {stop.latitude && stop.longitude && (
                    <div className="space-y-1">
                      <StopLocationPreviewMap
                        key={`${stop.id}-${stop.latitude}-${stop.longitude}`}
                        latitude={parseFloat(stop.latitude)}
                        longitude={parseFloat(stop.longitude)}
                      />
                      <p className="text-xs text-slate-500">
                        Latitude: {stop.latitude}, Longitude: {stop.longitude}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddStop}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
          >
            <Plus size={18} />
            Add Stop
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isLoading ? "Updating..." : "Update Route"}
        </button>
      </div>

      <StopLocationPickerModal
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerStopIndex(null);
        }}
        initialLocation={
          pickerStopIndex !== null &&
          stops[pickerStopIndex].latitude &&
          stops[pickerStopIndex].longitude
            ? {
                latitude: parseFloat(stops[pickerStopIndex].latitude),
                longitude: parseFloat(stops[pickerStopIndex].longitude),
              }
            : undefined
        }
        onConfirm={handleStopLocationConfirm}
      />
    </Modal>
  );
}
