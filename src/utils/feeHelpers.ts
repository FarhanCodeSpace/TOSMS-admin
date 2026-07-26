import { format, subMonths } from "date-fns";

export type FeeStatus = "pending" | "submitted" | "verified";

export type FeePaymentLike = {
  paymentStatus?: string;
  feeExempt?: boolean;
  amount?: number;
  fareAmount?: number;
  month?: string;
  studentId?: string;
};

export function normalizeFeeStatus(status?: string): FeeStatus {
  if (status === "verified" || status === "submitted") {
    return status;
  }
  return "pending";
}

export function normalizeFeeAmount(payment: FeePaymentLike): number {
  return Number(payment.amount ?? payment.fareAmount ?? 0);
}

export function isFeeExempt(payment: FeePaymentLike): boolean {
  return payment.feeExempt === true;
}

export function isSubmittedForReview(payment: FeePaymentLike): boolean {
  return (
    !isFeeExempt(payment) &&
    normalizeFeeStatus(payment.paymentStatus) === "submitted"
  );
}

export function isVerifiedPayment(payment: FeePaymentLike): boolean {
  return (
    !isFeeExempt(payment) &&
    normalizeFeeStatus(payment.paymentStatus) === "verified"
  );
}

export function isSettledForMonth(payment: FeePaymentLike): boolean {
  if (isFeeExempt(payment)) return true;

  const status = normalizeFeeStatus(payment.paymentStatus);
  return status === "submitted" || status === "verified";
}

export function getRecentMonthKeys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = subMonths(new Date(), count - 1 - index);
    return format(date, "yyyy-MM");
  });
}

export function isPaddlePayment(method?: string): boolean {
  const value = String(method || "")
    .toLowerCase()
    .replace(/[\s-]/g, "_");
  return value.includes("paddle") || value === "card";
}
