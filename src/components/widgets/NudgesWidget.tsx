import React from 'react';
import { Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { useNudges, useRefreshHealth } from '../../hooks/useHorizonData';
import { cn } from '../../lib/utils';

interface Props {
  onContactSelect: (id: string, name: string) => void;
}

const NudgesWidget: React.FC<Props> = ({ onContactSelect }) => {
  const { data: nudges, isLoading } = useNudges();
  const refreshHealth = useRefreshHealth();

  const priorityBg = (score: number) => {
    if (score >= 8)
      return 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400';
    if (score >= 5)
      return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400';
    return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400';
  };

  const top = (nudges ?? []).slice(0, 4);

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-amber-500" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Nudges</h3>
        </div>
        <button
          onClick={() => refreshHealth.mutate(undefined)}
          disabled={refreshHealth.isPending}
          className="text-blue-500 active:opacity-60 disabled:opacity-40"
        >
          <RefreshCw size={14} className={refreshHealth.isPending ? 'animate-spin' : undefined} />
        </button>
      </div>

      {top.length === 0 ? (
        <div className="p-6 text-center">
          <Sparkles size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-semibold">
            {isLoading ? 'Loading nudges…' : 'No nudges right now'}
          </p>
        </div>
      ) : (
        <div className="p-3 pt-1 space-y-2">
          {top.map((nudge) => (
            <button
              key={nudge.id}
              onClick={() => nudge.contact_id && onContactSelect(nudge.contact_id, nudge.contact_name)}
              className={cn(
                'w-full p-3 rounded-2xl border flex items-start gap-3 text-left active:scale-95 transition-transform',
                priorityBg(nudge.priority_score),
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-black truncate text-slate-900 dark:text-white">
                    {nudge.contact_name}
                  </p>
                  <span className="text-[9px] font-bold opacity-60 uppercase shrink-0">{nudge.due_in}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                  {nudge.reason}
                </p>
              </div>
              <ArrowRight size={12} className="shrink-0 mt-1 opacity-40" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NudgesWidget;
