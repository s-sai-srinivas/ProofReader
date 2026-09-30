export default function AdminLoading() {
  return (
    <div className="p-6 md:p-10 max-w-6xl w-full mx-auto flex flex-col gap-8 animate-pulse">
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="h-10 w-72 rounded-lg bg-white/5" />
        <div className="flex gap-3">
          <div className="h-10 w-24 rounded-lg bg-white/5" />
          <div className="h-10 w-28 rounded-lg bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white/5" />
          ))}
        </div>
        <div className="lg:col-span-3 h-96 rounded-2xl bg-white/5 border border-white/5" />
      </div>
    </div>
  );
}
