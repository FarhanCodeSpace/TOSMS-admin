import SkeletonLoader from "@/components/ui/SkeletonLoader";

export default function DashboardLoading() {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <SkeletonLoader rows={2} className="max-w-md" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="card" />
      </div>
      <SkeletonLoader variant="table" rows={6} />
    </div>
  );
}
