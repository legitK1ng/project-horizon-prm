import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 animate-pulse">
          <span className="font-bold text-3xl">H</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          Connecting to Horizon
        </h2>
        <p className="text-slate-500 dark:text-slate-400">Syncing with database...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
