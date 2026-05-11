import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, PhoneCall, AlertCircle, TrendingUp } from 'lucide-react';
import { useStats } from '../../hooks/useHorizonData';
import { cn } from '../../lib/utils';

const StatsWidget: React.FC = () => {
  const { data: stats } = useStats();
  const navigate = useNavigate();

  const tiles = [
    {
      icon: Users,
      label: 'Contacts',
      val: stats?.totalContacts ?? '—',
      color: 'blue',
      path: '/contacts',
    },
    {
      icon: PhoneCall,
      label: 'This Week',
      val: stats?.callsThisWeek ?? '—',
      color: 'emerald',
      path: '/calls',
    },
    {
      icon: AlertCircle,
      label: 'Attention',
      val: stats?.needsAttention ?? '—',
      color: 'amber',
      path: '/contacts',
    },
    {
      icon: TrendingUp,
      label: 'Health',
      val: stats?.avgHealth != null ? `${stats.avgHealth}%` : '—',
      color: 'purple',
      path: '/contacts',
    },
  ];

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-lg">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">
        Network Status
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            onClick={() => navigate(tile.path)}
            className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 active:scale-95 transition-transform duration-100 text-left"
          >
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center',
                tile.color === 'blue' && 'bg-blue-500/10 text-blue-500',
                tile.color === 'emerald' && 'bg-emerald-500/10 text-emerald-500',
                tile.color === 'amber' && 'bg-amber-500/10 text-amber-500',
                tile.color === 'purple' && 'bg-purple-500/10 text-purple-500',
              )}
            >
              <tile.icon size={16} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                {tile.val}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                {tile.label}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StatsWidget;
