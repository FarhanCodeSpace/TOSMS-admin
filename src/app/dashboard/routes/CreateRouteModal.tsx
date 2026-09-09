"use client";

import { DragEvent, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Plus, Trash2, GripVertical, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";

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

const createStop = (order: number): Stop => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${order}-${Math.random().toString(36).slice(2)}`,
  stopName: "",
  order,
  latitude: "",
  longitude: "",
});

type CreateRouteModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function CreateRouteModal({
  open,
  onClose,
}: CreateRouteModalProps) {
  const [step, setStep] = useState(1); // 1 or 2
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Basic Info
  const [routeName, setRouteName] = useState("");
  const [description, setDescription] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Step 2: Stops
  const [stops, setStops] = useState<Stop[]>([createStop(1), createStop(2)]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStopIndex, setPickerStopIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setRouteName("");
      setDescription("");
      setDepartureTime("");
      setReturnTime("");
      setIsActive(true);
      setStops([createStop(1), createStop(2)]);
    } else {
      setStep(1);
      setRouteName("");
      setDescription("");
      setDepartureTime("");
      setReturnTime("");
      setIsActive(true);
      setStops([createStop(1), createStop(2)]);
    }
  }, [open]);

  const handleAddStop = () => {
    setStops([...stops, createStop(stops.length + 1)]);
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

  const handleNext = () => {
    // Validate Step 1
    if (!routeName.trim()) {
      toast.error("Please fill in all required fields (Route Name)");
      return;
    }

    if (!departureTime && !returnTime) {
      toast.error("At least one time (Departure or Return) must be set");
      return;
    }
    
    setStep(2);
  };

  const handleSubmit = async () => {

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
      await addDoc(collection(db, COLLECTIONS.ROUTES), {
        routeName,
        name: routeName,
        description,
        departureTime,
        returnTime,
        isActive,
        stops: stops.map((s) => ({
          stopName: s.stopName,
          order: s.order,
          coordinates: {
            latitude: parseFloat(s.latitude),
            longitude: parseFloat(s.longitude),
          },
        })),
        studentIds: [],
        assignedDriverId: "",
        assignedDriverName: "",
        createdAt: serverTimestamp(),
      });

      toast.success("Route created successfully");
      onClose();
      setStep(1);
      // Reset form
      setRouteName("");
      setDescription("");
      setDepartureTime("");
      setReturnTime("");
      setIsActive(true);
      setStops([createStop(1), createStop(2)]);
    } catch (error) {
      console.error("Error creating route:", error);
      toast.error("Failed to create route");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setStep(1);
    setRouteName("");
    setDescription("");
    setDepartureTime("");
    setReturnTime("");
    setIsActive(true);
    setStops([createStop(1), createStop(2)]);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleCloseModal}
      title={`Create Route - Step ${step}/2`}
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {step === 1 ? (
          // Step 1: Basic Info
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Route Name *
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g., North Route 1"
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
                placeholder="Route description..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Departure Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setDepartureTime("")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      departureTime === ""
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Return Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setReturnTime("")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      returnTime === ""
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-200"
                />
                <span className="text-sm text-slate-700">Active</span>
              </label>
            </div>
          </div>
        ) : (
          // Step 2: Stops
          <div className="space-y-4">
            <div className="space-y-3 max-h-80 overflow-y-auto">
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
            >
              <Plus size={18} />
              Add Stop
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            onClick={handleCloseModal}
            disabled={isLoading}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancel
          </button>

          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              disabled={isLoading}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-50"
            >
              Back
            </button>
          )}

          {step === 1 ? (
            <button
              onClick={handleNext}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Route"}
            </button>
          )}
        </div>
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
