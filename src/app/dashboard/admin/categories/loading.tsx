export default function AdminLoading() {
  return (
    <div className="flex-1 p-6 md:p-10 flex flex-col gap-8 max-w-6xl w-full mx-auto animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-9 w-64 rounded-lg bg-white/5" />
        <div className="h-9 w-32 rounded-lg bg-white/5" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
      <div className="h-16 rounded-xl bg-white/5 border border-white/5" />
      <div className="h-72 rounded-xl bg-white/5 border border-white/5" />
    </div>
  );
}
