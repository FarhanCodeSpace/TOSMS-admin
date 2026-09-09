import { after, NextResponse } from "next/server";
import { format } from "date-fns";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getPaddle, TOSMS_FEE_PRODUCT_ID } from "@/lib/paddle-server";
import { PKR_PER_USD, pkrToUsdCents } from "@/lib/currency";
import { startAutoFulfillPolling } from "@/lib/paddle-fulfill";

type CreateBody = {
  returnUrl?: string;
  /** Phone-reachable admin API base, e.g. http://10.10.86.23:3000 */
  apiBase?: string;
};

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function findOrCreateCustomer(
  email: string,
  name: string,
): Promise<string> {
  const paddle = getPaddle();
  try {
    const created = await paddle.customers.create({ email, name });
    return created.id;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "detail" in error &&
            typeof error.detail === "string"
          ? error.detail
          : "";
    const match = message.match(/customer of id (ctm_[a-z0-9]+)/i);
    if (match?.[1]) return match[1];
    throw error;
  }
}

/** Must be an approved Paddle checkout domain (not a LAN IP). */
function getCheckoutPageUrl(): string {
  const configured = process.env.PADDLE_CHECKOUT_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  // Approved sandbox domain for this account
  return "https://car-rental-fyp-nine.vercel.app/tosms-checkout";
}

function paddleErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "forbidden"
  ) {
    return "Paddle API key is forbidden/revoked. Create a new sandbox API key and update PADDLE_API_KEY in .env.";
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "detail" in error &&
    typeof error.detail === "string"
  ) {
    return error.detail;
  }
  if (error instanceof Error) return error.message;
  return "Failed to create Paddle transaction";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: CreateBody;
    try {
      body = (await request.json()) as CreateBody;
    } catch {
      body = {};
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userSnap.data();
    if (!user || user.role !== "student") {
      return NextResponse.json(
        { error: "Only students can pay transport fees" },
        { status: 403 },
      );
    }

    const routeId = typeof user.routeId === "string" ? user.routeId : "";
    if (!routeId) {
      return NextResponse.json(
        { error: "No route assigned. Contact admin." },
        { status: 400 },
      );
    }

    const routeSnap = await db.collection("routes").doc(routeId).get();
    if (!routeSnap.exists) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    const settingsSnap = await db.collection("settings").doc("companyInfo").get();
    const settings = settingsSnap.data() || {};
    const feeAmount = Number(settings.monthlyFee ?? 0);

    if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
      return NextResponse.json(
        { error: "Global monthly fee is not configured" },
        { status: 400 },
      );
    }

    const month = format(new Date(), "yyyy-MM");

    const existingPay = await db
      .collection("feePayments")
      .where("studentId", "==", uid)
      .where("month", "==", month)
      .limit(5)
      .get();

    const alreadyPaid = existingPay.docs.some((doc) => {
      const status = doc.data().paymentStatus;
      return status === "verified" || status === "submitted";
    });
    if (alreadyPaid) {
      return NextResponse.json(
        { error: "Fee for this month is already paid or under review" },
        { status: 409 },
      );
    }

    const email =
      typeof user.email === "string" && user.email
        ? user.email
        : decoded.email || "";
    const fullName =
      typeof user.fullName === "string" && user.fullName
        ? user.fullName
        : "Student";

    if (!email) {
      return NextResponse.json(
        { error: "Student email is required for card payment" },
        { status: 400 },
      );
    }

    const amountUsdCents = pkrToUsdCents(feeAmount);
    if (amountUsdCents < 1) {
      return NextResponse.json(
        { error: "Fee amount is too small to charge via Paddle" },
        { status: 400 },
      );
    }

    const customerId = await findOrCreateCustomer(email, fullName);
    await db.collection("users").doc(uid).set(
      {
        paddleCustomerId: customerId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const returnUrl =
      typeof body.returnUrl === "string" && body.returnUrl.trim()
        ? body.returnUrl.trim()
        : "tosms://payment-return";

    // Server env wins so stale Expo bundles cannot send localhost.
    const requestOrigin = new URL(request.url).origin;
    const clientApiBase =
      typeof body.apiBase === "string" ? body.apiBase.trim().replace(/\/$/, "") : "";
    const configuredApiBase = process.env.TOSMS_PUBLIC_API_BASE
      ?.trim()
      .replace(/\/$/, "");
    const apiBase =
      configuredApiBase ||
      (clientApiBase && !clientApiBase.includes("localhost")
        ? clientApiBase
        : requestOrigin);

    const checkoutBase = getCheckoutPageUrl();
    const checkoutPageUrl = new URL(checkoutBase);
    checkoutPageUrl.searchParams.set("returnUrl", returnUrl);
    if (apiBase) {
      checkoutPageUrl.searchParams.set("apiBase", apiBase);
    }

    const paddle = getPaddle();
    const transaction = await paddle.transactions.create({
      customerId,
      currencyCode: "USD",
      collectionMode: "automatic",
      customData: {
        app: "tosms",
        studentId: uid,
        studentName: fullName,
        routeId,
        month,
        amountPkr: String(feeAmount),
        amountUsdCents: String(amountUsdCents),
        pkrPerUsd: String(PKR_PER_USD),
        returnUrl,
        apiBase,
      },
      checkout: {
        url: checkoutPageUrl.toString(),
      },
      items: [
        {
          quantity: 1,
          price: {
            description: `TOSMS transport fee ${month}`,
            name: `Transport Fee — ${month}`,
            productId: TOSMS_FEE_PRODUCT_ID,
            taxMode: "account_setting",
            unitPrice: {
              amount: String(amountUsdCents),
              currencyCode: "USD",
            },
          },
        },
      ],
    });

    const checkoutUrl = transaction.checkout?.url;
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Paddle did not return a checkout URL" },
        { status: 502 },
      );
    }

    // Server-side auto-fulfill: polls Paddle until paid, then writes Firestore.
    // Does not depend on the mobile deep-link / browser callback.
    after(() => {
      startAutoFulfillPolling(transaction.id);
    });

    return NextResponse.json({
      checkoutUrl,
      transactionId: transaction.id,
      amountPkr: feeAmount,
      amountUsdCents,
      month,
    });
  } catch (error) {
    console.error("create-transaction failed:", error);
    return NextResponse.json(
      { error: paddleErrorMessage(error) },
      { status: 500 },
    );
  }
}
