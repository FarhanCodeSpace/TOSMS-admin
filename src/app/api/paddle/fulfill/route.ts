import { NextResponse } from "next/server";
import { fulfillTosmsFeeTransaction } from "@/lib/paddle-fulfill";

type FulfillBody = {
  transactionId?: string;
};

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request): Promise<Response> {
  const headers = corsHeaders(request);
  try {
    let body: FulfillBody;
    try {
      body = (await request.json()) as FulfillBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers },
      );
    }

    const transactionId =
      typeof body.transactionId === "string" ? body.transactionId : "";
    const result = await fulfillTosmsFeeTransaction(transactionId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, status: result.status },
        { status: result.httpStatus, headers },
      );
    }

    return NextResponse.json(
      {
        success: true,
        paymentId: result.paymentId,
        alreadyVerified: result.alreadyVerified,
      },
      { headers },
    );
  } catch (error) {
    console.error("paddle fulfill failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fulfill payment";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
