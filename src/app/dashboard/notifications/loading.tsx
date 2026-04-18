import SkeletonLoader from "@/components/ui/SkeletonLoader";

export default function NotificationsLoading() {
  return (
    <div className="min-h-screen bg-[var(--surface)] p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header skeleton */}
        <div className="mb-8 space-y-2">
          <SkeletonLoader variant="card" h-12 className="w-48" />
          <SkeletonLoader variant="card" h-4 className="w-72" />
        </div>

        {/* Filter tabs skeleton */}
        <div className="mb-6 flex flex-wrap gap-2">
          <SkeletonLoader variant="card" h-10 className="w-32" />
          <SkeletonLoader variant="card" h-10 className="w-32" />
          <SkeletonLoader variant="card" h-10 className="w-32" />
          <SkeletonLoader variant="card" h-10 className="w-32" />
        </div>

        {/* Notifications skeleton */}
        <div className="space-y-4">
          <SkeletonLoader variant="card" h-24 />
          <SkeletonLoader variant="card" h-24 />
          <SkeletonLoader variant="card" h-24 />
          <SkeletonLoader variant="card" h-24 />
        </div>
      </div>
    </div>
  );
}
