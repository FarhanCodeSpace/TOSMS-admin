import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getPaddle } from "@/lib/paddle-server";
import { PKR_PER_USD } from "@/lib/currency";

function readCustomString(
  customData: Record<string, unknown> | null | undefined,
  key: string,
): string {
  if (!customData) return "";
  const value = customData[key];
  return typeof value === "string" ? value : String(value ?? "");
}

export type FulfillResult =
  | { ok: true; paymentId: string; alreadyVerified: boolean }
  | { ok: false; error: string; status?: string; httpStatus: number };

/**
 * Writes a verified feePayments doc after confirming the Paddle transaction.
 * Idempotent: same txn id always maps to the same Firestore doc.
 */
export async function fulfillTosmsFeeTransaction(
  transactionId: string,
): Promise<FulfillResult> {
  const trimmed = transactionId.trim();
  if (!trimmed.startsWith("txn_")) {
    return {
      ok: false,
      error: "transactionId is required",
      httpStatus: 400,
    };
  }

  const paddle = getPaddle();
  const transaction = await paddle.transactions.get(trimmed);

  if (transaction.status !== "completed" && transaction.status !== "paid") {
    return {
      ok: false,
      error: `Payment not completed yet (status: ${transaction.status})`,
      status: transaction.status,
      httpStatus: 409,
    };
  }

  const customData =
    transaction.customData && typeof transaction.customData === "object"
      ? (transaction.customData as Record<string, unknown>)
      : null;

  if (readCustomString(customData, "app") !== "tosms") {
    return {
      ok: false,
      error: "Not a TOSMS fee transaction",
      httpStatus: 403,
    };
  }

  const studentId = readCustomString(customData, "studentId");
  const month = readCustomString(customData, "month");
  const routeId = readCustomString(customData, "routeId");
  const studentName = readCustomString(customData, "studentName") || "Student";
  const amountPkr = Number(readCustomString(customData, "amountPkr") || 0);
  const amountUsdCents = Number(
    readCustomString(customData, "amountUsdCents") || 0,
  );

  if (!studentId || !month || !amountPkr) {
    return {
      ok: false,
      error: "Transaction is missing fee metadata",
      httpStatus: 422,
    };
  }

  const db = getAdminDb();
  const paymentRef = db.collection("feePayments").doc(trimmed);
  const existing = await paymentRef.get();
  if (existing.exists) {
    return {
      ok: true,
      paymentId: trimmed,
      alreadyVerified: true,
    };
  }

  await paymentRef.set({
    paymentId: trimmed,
    studentId,
    studentName,
    routeId,
    month,
    amount: amountPkr,
    amountUsdCents,
    pkrPerUsd: PKR_PER_USD,
    paymentMethod: "paddle",
    paymentStatus: "verified",
    paddleTransactionId: trimmed,
    transactionId: trimmed,
    submittedAt: FieldValue.serverTimestamp(),
    verifiedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    paymentId: trimmed,
    alreadyVerified: false,
  };
}

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 48; // ~2 minutes

/**
 * Background poller: waits for Paddle to mark the txn completed, then writes Firestore.
 * Fire-and-forget from create-transaction — does not depend on the mobile app.
 */
export function startAutoFulfillPolling(transactionId: string): void {
  void (async () => {
    for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await fulfillTosmsFeeTransaction(transactionId);
        if (result.ok) {
          console.log(
            `[paddle-auto-fulfill] saved ${transactionId} (attempt ${attempt}, already=${result.alreadyVerified})`,
          );
          return;
        }
        if (result.httpStatus !== 409) {
          console.error(
            `[paddle-auto-fulfill] stop ${transactionId}: ${result.error}`,
          );
          return;
        }
      } catch (error) {
        console.error(`[paddle-auto-fulfill] error ${transactionId}:`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    console.error(
      `[paddle-auto-fulfill] timed out waiting for ${transactionId}`,
    );
  })();
}
