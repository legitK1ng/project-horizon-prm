interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "Connecting to Horizon..." }) => {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Simulated Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 p-4">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg skeleton" />
          <div className="h-5 w-28 skeleton" />
        </div>
        {/* Nav Items */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="w-5 h-5 rounded skeleton" />
              <div className="h-4 skeleton" style={{ width: `${60 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Simulated Main Content */}
      <div className="flex-1 p-8 lg:p-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header Skeleton */}
          <div>
            <div className="h-8 w-56 skeleton mb-3" />
            <div className="h-4 w-80 skeleton" />
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl skeleton" />
                  <div className="w-16 h-5 skeleton rounded-full" />
                </div>
                <div className="h-3 w-16 skeleton mb-2" />
                <div className="h-8 w-12 skeleton" />
              </div>
            ))}
          </div>

          {/* Chart + Briefs Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card p-6">
              <div className="h-5 w-40 skeleton mb-6" />
              <div className="h-48 skeleton rounded-xl" />
            </div>
            <div className="card p-6">
              <div className="flex justify-between mb-6">
                <div className="h-5 w-32 skeleton" />
                <div className="h-4 w-16 skeleton" />
              </div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-50 dark:border-slate-800">
                    <div className="h-3 w-24 skeleton mb-3" />
                    <div className="h-5 w-3/4 skeleton mb-2" />
                    <div className="h-3 w-full skeleton" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Centered loading indicator */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-700/50 rounded-full px-6 py-3 flex items-center gap-3 z-50 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
