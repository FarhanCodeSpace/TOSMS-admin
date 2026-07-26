import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { fulfillTosmsFeeTransaction } from "@/lib/paddle-fulfill";

type VerifyBody = {
  transactionId?: string;
};

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: VerifyBody;
    try {
      body = (await request.json()) as VerifyBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);

    const transactionId =
      typeof body.transactionId === "string" ? body.transactionId.trim() : "";
    const result = await fulfillTosmsFeeTransaction(transactionId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, status: result.status },
        { status: result.httpStatus },
      );
    }

    // Extra ownership check when we can read the doc metadata via a second get —
    // fulfill already checked custom_data.studentId against Paddle.
    // Re-fetch through paddle is already done inside fulfill; ensure token uid matches
    // by reading custom data again only if needed. For simplicity, trust fulfill
    // which required app=tosms + studentId in custom_data; verify caller is that student
    // by comparing against a lightweight paddle get only when not already verified path.
    const { getPaddle } = await import("@/lib/paddle-server");
    const txn = await getPaddle().transactions.get(result.paymentId);
    const custom =
      txn.customData && typeof txn.customData === "object"
        ? (txn.customData as Record<string, unknown>)
        : null;
    const studentId =
      custom && typeof custom.studentId === "string" ? custom.studentId : "";
    if (studentId && studentId !== decoded.uid) {
      return NextResponse.json(
        { error: "Transaction does not belong to this student" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: result.paymentId,
      alreadyVerified: result.alreadyVerified,
    });
  } catch (error) {
    console.error("paddle verify failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to verify payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
