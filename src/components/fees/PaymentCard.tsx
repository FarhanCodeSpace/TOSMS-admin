"use client";

import { useState } from "react";
import { Loader2, CheckCircle, XCircle, Eye } from "lucide-react";
import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import type { FeePayment } from "@/types";
import {
  formatPKR,
  formatRelative,
  formatPaymentMethod,
} from "@/utils/formatters";
import { isPaddlePayment } from "@/utils/feeHelpers";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import Image from "next/image";

type PaymentCardProps = {
  payment: FeePayment;
  studentAvatar?: string;
  // eslint-disable-next-line no-unused-vars
  onReceiptView?: (url: string) => void;
};

export default function PaymentCard({
  payment,
  studentAvatar,
  onReceiptView,
}: PaymentCardProps) {
  const paymentData = payment as FeePayment & Record<string, unknown>;

  const normalizeMethod = (
    method: unknown,
  ): "bank_challan" | "easypaisa" | "jazzcash" | "paddle" | "other" => {
    const value = String(method || "")
      .toLowerCase()
      .replace(/[\s-]/g, "_");

    if (value.includes("bank") || value.includes("challan")) {
      return "bank_challan";
    }
    if (value.includes("easy")) {
      return "easypaisa";
    }
    if (value.includes("jazz")) {
      return "jazzcash";
    }
    if (value.includes("paddle") || value === "card") {
      return "paddle";
    }

    return "other";
  };

  const getStringField = (...keys: string[]) => {
    for (const key of keys) {
      const raw = paymentData[key];
      if (typeof raw === "string" && raw.trim()) {
        return raw.trim();
      }
    }
    return "";
  };

  const paymentMethod = normalizeMethod(paymentData.paymentMethod);
  const challanNumber = getStringField(
    "challanNumber",
    "challanNo",
    "challan_number",
  );
  const receiptUrl = getStringField(
    "receiptImageUrl",
    "receiptUrl",
    "proofImageUrl",
  );
  const transactionId = getStringField(
    "transactionId",
    "transactionID",
    "trxId",
    "txnId",
    "paddleTransactionId",
  );
  const isCardPaid = isPaddlePayment(String(paymentData.paymentMethod || ""));

  const [verifyLoading, setVerifyLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleVerify = async () => {
    setVerifyLoading(true);
    try {
      // Update payment document
      await updateDoc(doc(db, COLLECTIONS.FEE_PAYMENTS, payment.paymentId), {
        paymentStatus: "verified",
        verifiedAt: serverTimestamp(),
      });

      // Update challan document if payment method is bank_challan
      if (paymentMethod === "bank_challan" && challanNumber) {
        // Find challan by challan number — query would be in production
        const allChallans = await fetch(
          `/api/challans?challanNumber=${challanNumber}`,
        );
        if (allChallans.ok) {
          const challans = await allChallans.json();
          if (challans.length > 0) {
            await updateDoc(doc(db, COLLECTIONS.CHALLANS, challans[0].id), {
              status: "verified",
            });
          }
        }
      }

      toast.success("Payment verified! Student has been notified.");
      setConfirmOpen(false);
    } catch (error) {
      console.error("Verify payment error:", error);
      toast.error("Failed to verify payment");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setRejectLoading(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.FEE_PAYMENTS, payment.paymentId), {
        paymentStatus: "pending",
        rejectionReason: rejectionReason.trim(),
      });

      toast.success("Payment rejected. Student will need to resubmit.");
      setRejectModalOpen(false);
      setRejectionReason("");
    } catch (error) {
      console.error("Reject payment error:", error);
      toast.error("Failed to reject payment");
    } finally {
      setRejectLoading(false);
    }
  };

  const getPaymentMethodIcon = () => {
    switch (paymentMethod) {
      case "bank_challan":
        return "🏦";
      case "easypaisa":
        return "💳";
      case "jazzcash":
        return "📱";
      case "paddle":
        return "💳";
      default:
        return "💰";
    }
  };

  return (
    <>
      <div className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
        {/* Left: Avatar, Name, Route, Month */}
        <div className="flex items-start gap-3 min-w-[200px]">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {studentAvatar ? (
              <Image
                src={studentAvatar}
                alt={payment.studentName}
                width={48}
                height={48}
                className="rounded-full w-full h-full object-cover"
              />
            ) : (
              payment.studentName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">
              {payment.studentName}
            </p>
            <p className="text-sm text-slate-600">Route: {payment.routeId}</p>
            <p className="text-sm text-slate-600">Month: {payment.month}</p>
          </div>
        </div>

        {/* Middle: Payment Details */}
        <div className="flex-1 flex items-start gap-4">
          <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-900">
              {formatPKR(payment.amount)}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {getPaymentMethodIcon()} {formatPaymentMethod(paymentMethod)}
            </p>
            {paymentMethod === "bank_challan" && challanNumber ? (
              <div className="mt-2">
                <p className="text-xs font-mono text-slate-600">
                  Challan: {challanNumber}
                </p>
                {receiptUrl && (
                  <button
                    onClick={() => onReceiptView?.(receiptUrl)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Eye size={14} />
                    View Receipt
                  </button>
                )}
              </div>
            ) : null}
            {(paymentMethod === "easypaisa" ||
              paymentMethod === "jazzcash" ||
              paymentMethod === "paddle") &&
            transactionId ? (
              <p className="text-xs font-mono text-slate-600 mt-2">
                {paymentMethod === "paddle" ? "Paddle: " : "TID: "}
                {transactionId}
              </p>
            ) : null}
            {paymentMethod === "paddle" ? (
              <span className="inline-flex mt-2 items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                Paid by card
              </span>
            ) : null}
            <p className="text-xs text-slate-500 mt-2">
              Submitted {formatRelative(payment.submittedAt)}
            </p>
          </div>
        </div>

        {/* Right: Action Buttons — Paddle payments are already verified */}
        <div className="flex flex-col gap-2 min-w-[140px] flex-shrink-0">
          {isCardPaid || payment.paymentStatus === "verified" ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 py-2 px-3 text-sm font-semibold">
              <CheckCircle size={16} />
              Verified
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={verifyLoading}
                className="flex items-center justify-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 text-white py-2 px-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Verify
              </button>
              <button
                onClick={() => setRejectModalOpen(true)}
                disabled={rejectLoading}
                className="flex items-center justify-center gap-2 rounded-lg border border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700 py-2 px-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejectLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <XCircle size={16} />
                )}
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Verify Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Verify Payment"
        message={`Verify payment of ${formatPKR(payment.amount)} from ${payment.studentName}?`}
        confirmLabel="Verify"
        cancelLabel="Cancel"
        onConfirm={handleVerify}
        onCancel={() => setConfirmOpen(false)}
        isLoading={verifyLoading}
      />

      {/* Reject Reason Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectionReason("");
        }}
        title="Reject Payment"
        isLoading={rejectLoading}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Please provide a reason for rejecting this payment:
          </p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g., Challan amount doesn't match, Receipt unclear, etc."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={4}
            disabled={rejectLoading}
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setRejectModalOpen(false);
                setRejectionReason("");
              }}
              disabled={rejectLoading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={rejectLoading || !rejectionReason.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rejectLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              Reject Payment
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
