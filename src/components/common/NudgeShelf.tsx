import React, { useRef } from 'react';
import { Nudge } from '@/types';
import { 
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Zap,
  Clock,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/utils/ui';
import { useNudges, useRefreshHealth } from '@/hooks/useHorizonData';

interface NudgeShelfProps {
  onContactClick?: (contactId: string) => void;
}

const NudgeShelf: React.FC<NudgeShelfProps> = ({ onContactClick }) => {
  const { data: nudges, isLoading, isError } = useNudges();
  const { mutate: refreshHealth, isPending: isRefreshing } = useRefreshHealth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
        {[1, 2, 3].map(i => (
          <div key={i} className="min-w-[300px] h-[160px] glass rounded-3xl animate-pulse bg-slate-100/10" />
        ))}
      </div>
    );
  }

  if (isError || !nudges || nudges.length === 0) {
     return (
       <div className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 mb-4">
             <TrendingUp size={24} />
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">All Clear</h4>
          <p className="text-sm text-slate-500 mt-1">Relationships are currently optimized. Check back later for new nudges.</p>
          <button 
            onClick={() => refreshHealth('all')}
            disabled={isRefreshing}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
            {isRefreshing ? 'Analyzing...' : 'Force Analysis'}
          </button>
       </div>
     );
  }

  return (
    <div className="relative group/shelf">
      {/* Scroll Controls */}
      <button 
        onClick={() => scroll('left')}
        className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 opacity-0 group-hover/shelf:opacity-100 transition-all hover:scale-110"
      >
        <ChevronLeft size={20} />
      </button>
      
      <button 
        onClick={() => scroll('right')}
        className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 opacity-0 group-hover/shelf:opacity-100 transition-all hover:scale-110"
      >
        <ChevronRight size={20} />
      </button>

      <div 
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory px-2"
      >
        {nudges.map((nudge: Nudge) => (
          <div 
            key={`${nudge.contact_id}-${nudge.name}`}
            onClick={() => onContactClick?.(nudge.contact_id)}
            className="min-w-[320px] md:min-w-[380px] snap-start glass p-6 rounded-[2rem] border border-white/20 dark:border-white/5 shadow-glow hover:shadow-glow-lg transition-all cursor-pointer group/nudge relative overflow-hidden"
          >
            {/* Background Accent */}
            <div className={cn(
              "absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 blur-3xl opacity-20 transition-opacity group-hover/nudge:opacity-40",
              (nudge.score ?? 0) < 30 ? "bg-rose-500" : "bg-amber-500"
            )} />

            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className={cn(
                "p-3 rounded-2xl shadow-sm",
                (nudge.score ?? 0) < 30 ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
              )}>
                <Zap size={18} />
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Health</p>
                  <p className={cn(
                    "text-lg font-black",
                    (nudge.score ?? 0) < 30 ? "text-rose-500" : "text-amber-500"
                  )}>{nudge.score}%</p>
                </div>
              </div>
            </div>

            <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter mb-1 relative z-10">
              {nudge.name}
            </h4>
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <Clock size={12} className="text-slate-400" />
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 italic">
                {nudge.nudge_type || 'Engagement Nudge'}
              </p>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-6 font-medium relative z-10">
              {nudge.reason}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/50 relative z-10">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Action Required
              </span>
              <button className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest group-hover/nudge:gap-3 transition-all">
                {nudge.suggested_action} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}

        {/* Refresh Card at the end */}
        <div 
          onClick={() => refreshHealth('all')}
          className="min-w-[120px] snap-start flex flex-col items-center justify-center glass rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer group/refresh"
        >
          <div className={cn(
            "p-4 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 group-hover/refresh:text-blue-500 transition-colors",
            isRefreshing && "animate-spin text-blue-500"
          )}>
            <RefreshCw size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Sync Engine</p>
        </div>
      </div>
    </div>
  );
};

export default NudgeShelf;
