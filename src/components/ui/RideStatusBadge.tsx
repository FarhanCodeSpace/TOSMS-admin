import { cn } from "@/lib/utils";

export function RideStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = (status || "").toLowerCase();

  if (s === "waiting" || s === "requested") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-orange-700",
          className
        )}
      >
        Waiting
      </span>
    );
  }

  if (s === "accepted") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200",
          className
        )}
      >
        Accepted
      </span>
    );
  }

  if (s === "active") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700",
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    );
  }

  if (s === "completed") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700",
          className
        )}
      >
        Completed
      </span>
    );
  }

  if (s === "cancelled") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700",
          className
        )}
      >
        Cancelled
      </span>
    );
  }

  if (s === "rejected") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-[#EEDDCC] px-2.5 py-1 text-xs font-semibold text-[#8B4513]",
          className
        )}
      >
        Rejected
      </span>
    );
  }

  if (s === "withdrawn") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800",
          className
        )}
      >
        Withdrawn
      </span>
    );
  }

  if (s === "scheduled") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700",
          className
        )}
      >
        Scheduled
      </span>
    );
  }

  // Fallback
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500 capitalize",
        className
      )}
    >
      {status || "Unknown"}
    </span>
  );
}
