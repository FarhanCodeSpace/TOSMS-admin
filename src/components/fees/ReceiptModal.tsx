"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Image from "next/image";

type ReceiptModalProps = {
  open: boolean;
  receiptUrl?: string;
  paddleTransactionId?: string;
  onClose: () => void;
};

export default function ReceiptModal({
  open,
  receiptUrl,
  paddleTransactionId,
  onClose,
}: ReceiptModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-2xl w-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 hover:bg-slate-100 transition-colors shadow-lg"
        >
          <X size={20} className="text-slate-900" />
        </button>

        <div className="relative h-auto w-full bg-white rounded-xl overflow-hidden p-4">
          {paddleTransactionId ? (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Paddle Transaction
              </p>
              <p className="mt-1 font-mono text-sm text-emerald-900 break-all">
                {paddleTransactionId}
              </p>
            </div>
          ) : null}
          {receiptUrl ? (
            <Image
              src={receiptUrl}
              alt="Receipt"
              width={800}
              height={1000}
              className="w-full h-auto object-contain"
              priority
            />
          ) : !paddleTransactionId ? (
            <p className="text-sm text-slate-500 text-center py-12">
              No receipt available.
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
