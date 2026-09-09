import React from "react";
import Image from "next/image";
import { User } from "@/types";
import { CheckCircle, XCircle } from "lucide-react";
import Modal from "./Modal";

interface CNICReviewModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export default function CNICReviewModal({
  open,
  onClose,
  user,
  onApprove,
  onReject,
  isLoading = false,
}: CNICReviewModalProps) {
  if (!user) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Verify CNIC Details"
      footer={
        <>
          <button
            onClick={onReject}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
          >
            <XCircle size={18} />
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle size={18} />
            Approve
          </button>
        </>
      }
    >
      <div className="mb-6 flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200">
        <div>
          <p className="text-sm font-medium text-slate-500">Applicant Name</p>
          <p className="text-lg font-semibold text-slate-900">{user.fullName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-500">CNIC Number</p>
          <p className="text-lg font-bold tracking-wider text-slate-900">
            {user.cnicNumber || user.cnic || "Not Provided"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Front Image */}
        <div className="space-y-2">
          <p className="font-semibold text-slate-700">CNIC Front</p>
          <div className="relative aspect-[1.6/1] w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
            {user.cnicFrontUrl ? (
              <Image
                src={user.cnicFrontUrl}
                alt="CNIC Front"
                fill
                className="object-contain"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No image uploaded
              </div>
            )}
          </div>
        </div>

        {/* Back Image */}
        <div className="space-y-2">
          <p className="font-semibold text-slate-700">CNIC Back</p>
          <div className="relative aspect-[1.6/1] w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
            {user.cnicBackUrl ? (
              <Image
                src={user.cnicBackUrl}
                alt="CNIC Back"
                fill
                className="object-contain"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No image uploaded
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
