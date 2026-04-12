"use client";

import { Loader2 } from "lucide-react";
import Modal from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  isLoading?: boolean;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} isLoading={isLoading}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-2xl px-6 py-2 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 min-w-[120px] disabled:cursor-not-allowed ${
              isLoading
                ? `${
                    destructive
                      ? "bg-rose-600 ring-2 ring-rose-400"
                      : "bg-[#1A3C5E] ring-2 ring-blue-400"
                  } animate-pulse`
                : destructive
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-[#1A3C5E] hover:bg-slate-900"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{confirmLabel}...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
