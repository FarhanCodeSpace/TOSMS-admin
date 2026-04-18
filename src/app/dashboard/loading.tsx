import SkeletonLoader from "@/components/ui/SkeletonLoader";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <SkeletonLoader rows={2} className="max-w-md" />
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-pulse" />
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Loading
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonLoader variant="card" className="h-40 rounded-2xl" />
        <SkeletonLoader variant="card" className="h-40 rounded-2xl" />
        <SkeletonLoader variant="card" className="h-40 rounded-2xl" />
        <SkeletonLoader variant="card" className="h-40 rounded-2xl" />
      </div>

      <SkeletonLoader variant="table" rows={6} />
    </div>
  );
}
