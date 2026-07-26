"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

function CheckoutInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing secure checkout…");

  const transactionId = searchParams.get("_ptxn");
  const returnUrlParam = searchParams.get("returnUrl");

  const returnUrl = useMemo(() => {
    if (returnUrlParam && returnUrlParam.startsWith("tosms://")) {
      return returnUrlParam;
    }
    return "tosms://payment-return";
  }, [returnUrlParam]);

  useEffect(() => {
    let cancelled = false;
    let paddle: Paddle | undefined;

    async function boot() {
      const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
      if (!token) {
        setError("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not configured");
        return;
      }

      if (!transactionId) {
        setError("Missing transaction. Open checkout from the TOSMS app.");
        return;
      }

      try {
        paddle = await initializePaddle({
          environment: "sandbox",
          token,
          eventCallback(event) {
            if (event.name === "checkout.completed") {
              const id =
                (event.data &&
                  typeof event.data === "object" &&
                  "id" in event.data &&
                  typeof event.data.id === "string" &&
                  event.data.id) ||
                transactionId;
              setStatus("Payment successful. Returning to TOSMS…");
              window.location.href = `${returnUrl}?transactionId=${encodeURIComponent(id)}`;
            }
            if (event.name === "checkout.closed") {
              setStatus("Checkout closed. You can return to the app.");
            }
            if (event.name === "checkout.error") {
              setError("Checkout failed. Please try again from the app.");
            }
          },
        });

        if (cancelled || !paddle) return;
        setStatus("Opening Paddle checkout…");
        // Paddle.js also auto-opens when _ptxn is present; this is a safety net.
        paddle.Checkout.open({ transactionId });
      } catch (err) {
        console.error("Paddle checkout init failed:", err);
        if (!cancelled) {
          setError("Failed to start checkout. Please try again.");
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [transactionId, returnUrl]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-400 mb-3">
          TOSMS · Secure Checkout
        </p>
        <h1 className="text-2xl font-bold mb-3">Card Payment</h1>
        {error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : (
          <p className="text-slate-300 text-sm">{status}</p>
        )}
        <p className="text-slate-500 text-xs mt-6">
          Powered by Paddle Sandbox. Do not close this window until payment
          completes.
        </p>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          Loading checkout…
        </main>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
