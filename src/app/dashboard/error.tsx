"use client";

import ErrorState from "@/components/ui/ErrorState";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <ErrorState
        title="Dashboard failed to load"
        message="Something went wrong while loading this page."
        retryLabel="Try again"
        onRetry={reset}
      />
    </div>
  );
}
