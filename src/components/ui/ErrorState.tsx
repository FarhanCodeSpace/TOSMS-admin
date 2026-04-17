"use client";

import { AlertTriangle } from "lucide-react";

type ErrorStateProps = {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export default function ErrorState({
  title = "Something went wrong",
  message = "We could not load this section. Please try again.",
  retryLabel = "Retry",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-rose-900">{title}</h3>
      <p className="mt-2 text-sm text-rose-700">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
