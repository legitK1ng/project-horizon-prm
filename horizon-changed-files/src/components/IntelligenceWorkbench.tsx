import React from 'react';
import { useWeeklyDigest, useNudges } from '@/hooks/useHorizonData';
import { Sparkles, TrendingUp, AlertCircle, ChevronRight, Activity, Zap, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/ui';

// FIX: Component now renders a self-contained single card (not a 3-col grid)
// so it can be dropped into any parent grid without breaking layout.
const IntelligenceWorkbench: React.FC = () => {
  const { data: digest, isLoading: digestLoading } = useWeeklyDigest();
  const { data: nudges, isLoading: nudgesLoading } = useNudges();

  return (
    <div className="flex flex-col gap-6">
      {/* Weekly Intelligence Synthesis */}
      <div className="card p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-2xl shadow-blue-500/20 overflow-hidden relative min-h-[280px] flex flex-col justify-between group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-all duration-1000" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/10 rounded-full -ml-24 -mb-24 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl">
              <Sparkles size={20} className="text-blue-100" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Intelligence Synthesis</h3>
              <p className="text-[9px] text-blue-200 mt-0.5 uppercase font-black tracking-[0.2em]">Weekly Briefing</p>
            </div>
          </div>

          {digestLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-full" />
              <div className="h-3 bg-white/10 rounded w-5/6" />
              <div className="h-3 bg-white/10 rounded w-4/6" />
            </div>
          ) : (
            <p className="text-sm font-medium leading-relaxed text-blue-50/90 [text-wrap:pretty]">
              {digest?.digest || "AI processors are analyzing your recent touchpoints. Check back shortly for your weekly strategic briefing."}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10">
              <Activity size={11} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {digest?.calls_analyzed ?? 0} Calls Analyzed
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10">
              <Zap size={11} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {nudges?.length ?? 0} Active Nudges
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-6 flex items-center justify-between">
          <button className="px-5 py-2.5 bg-white text-blue-700 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-1.5">
            Full Audit
            <ChevronRight size={14} />
          </button>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-blue-200 opacity-60">System</p>
            <p className="text-[10px] font-bold text-white">Ready</p>
          </div>
        </div>
      </div>

      {/* Proactive Nudges mini-list */}
      <div className="card p-6 bg-white dark:bg-slate-900 border-none shadow-md flex flex-col overflow-hidden relative">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-slate-100 dark:bg-slate-800 rounded-full blur-3xl opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Proactive Nudges</h3>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>

          <div className="space-y-4">
            {nudgesLoading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="h-9 w-9 bg-slate-100 dark:bg-slate-800 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : nudges && nudges.length > 0 ? (
              nudges.slice(0, 3).map((nudge: any) => (
                <div key={nudge.contact_id} className="flex items-start gap-3 group cursor-pointer">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all text-sm">
                      {(nudge.name || 'U')[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate">
                      {nudge.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-1 italic">
                      "{nudge.reason}"
                    </p>
                    {nudge.score !== undefined && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="h-1 w-10 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full", nudge.score < 30 ? "bg-red-500" : nudge.score < 60 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${nudge.score}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase">{nudge.score}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500 opacity-50" />
                <p className="text-xs font-medium text-slate-500">All relationships healthy!</p>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-6">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={12} className="text-blue-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Upcoming Milestone</span>
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Project Horizon Alpha v1 Launch</p>
            <p className="text-[10px] text-slate-400 mt-0.5 italic">3 high-value contacts briefed.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceWorkbench;
