export default function DashboardLoading() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-pulse">
      {/* Welcome skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-7 bg-gray-200 rounded-lg w-60 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-48" />
        </div>
        <div className="h-10 bg-gray-200 rounded-xl w-full sm:w-44" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
            <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-6 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="h-5 bg-gray-200 rounded w-36" />
        </div>
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 sm:px-6 py-4 flex items-center gap-4">
              <div className="h-5 bg-gray-200 rounded w-16" />
              <div className="h-5 bg-gray-200 rounded w-20" />
              <div className="h-5 bg-gray-200 rounded w-32 flex-1" />
              <div className="h-5 bg-gray-200 rounded w-20" />
              <div className="h-5 bg-gray-200 rounded w-24" />
              <div className="h-5 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
