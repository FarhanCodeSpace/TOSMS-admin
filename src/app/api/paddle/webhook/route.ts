import { NextResponse } from "next/server";
import { getPaddle } from "@/lib/paddle-server";
import { fulfillTosmsFeeTransaction } from "@/lib/paddle-fulfill";

/**
 * Paddle notification destination.
 * Set destination URL to a public tunnel/host of this route, then store
 * the returned endpoint_secret_key as PADDLE_WEBHOOK_SECRET.
 */
export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("paddle-signature") || "";
  const secret = process.env.PADDLE_WEBHOOK_SECRET || "";
  const rawBody = await request.text();

  if (!secret) {
    console.error("PADDLE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  try {
    const paddle = getPaddle();
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature);
    const eventType = event.eventType;

    if (
      eventType === "transaction.completed" ||
      eventType === "transaction.paid"
    ) {
      const data = event.data as { id?: string };
      const transactionId = typeof data.id === "string" ? data.id : "";
      if (transactionId.startsWith("txn_")) {
        const result = await fulfillTosmsFeeTransaction(transactionId);
        console.log("[paddle-webhook]", eventType, transactionId, result);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("paddle webhook failed:", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
