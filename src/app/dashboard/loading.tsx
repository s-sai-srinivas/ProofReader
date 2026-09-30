export default function DashboardLoading() {
  return (
    <div className="flex-1 p-6 md:p-10 flex flex-col gap-8 max-w-6xl w-full mx-auto animate-pulse">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-white/5 border border-white/5"
          />
        ))}
      </div>
      {/* Analytics area skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-xl bg-white/5 border border-white/5"
          />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="h-48 rounded-xl bg-white/5 border border-white/5" />
    </div>
  );
}
