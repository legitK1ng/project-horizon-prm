import React from 'react';
import { useWeeklyDigest, useNudges } from '@/hooks/useHorizonData';
import { Sparkles, TrendingUp, AlertCircle, ChevronRight, Activity, Zap, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/ui';

const IntelligenceWorkbench: React.FC = () => {
  const { data: digest, isLoading: digestLoading } = useWeeklyDigest();
  const { data: nudges, isLoading: nudgesLoading } = useNudges();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Weekly Intelligence Synthesis */}
      <div className="lg:col-span-2 card p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-2xl shadow-blue-500/20 overflow-hidden relative min-h-[320px] flex flex-col justify-between group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-all duration-1000" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/10 rounded-full -ml-24 -mb-24 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
              <Sparkles size={24} className="text-blue-100" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Intelligence Synthesis</h3>
              <p className="text-[10px] text-blue-200 mt-1 uppercase font-black tracking-[0.2em]">Alpha Edition v1.0</p>
            </div>
          </div>

          <div className="space-y-6">
            {digestLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-full" />
                <div className="h-4 bg-white/10 rounded w-5/6" />
                <div className="h-4 bg-white/10 rounded w-4/6" />
              </div>
            ) : (
              <p className="text-lg font-medium leading-relaxed text-blue-50/90 [text-wrap:pretty]">
                {digest?.digest || "Our AI processors are analyzing your recent touchpoints. Check back shortly for your weekly strategic briefing."}
              </p>
            )}
            
            <div className="flex flex-wrap gap-4 pt-4">
               <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/20 transition-colors cursor-pointer group/pill">
                 <Activity size={14} className="group-hover/pill:text-green-400" />
                 <span className="text-xs font-bold uppercase tracking-wider">Velocity: 1.48x</span>
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/20 transition-colors cursor-pointer group/pill">
                 <Zap size={14} className="group-hover/pill:text-amber-400" />
                 <span className="text-xs font-bold uppercase tracking-wider">3 High Stakes</span>
               </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-12 flex items-center justify-between">
           <button className="px-8 py-3.5 bg-white text-blue-700 rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center gap-2">
             Full Relationship Audit
             <ChevronRight size={16} />
           </button>
           <div className="hidden sm:block text-right">
              <p className="text-[10px] font-black uppercase text-blue-200 opacity-60">System Ready</p>
              <p className="text-xs font-bold text-white">LATENCY: 42ms</p>
           </div>
        </div>
      </div>

      {/* Relationship Health Radar */}
      <div className="card p-8 bg-white dark:bg-slate-900 border-none shadow-glow flex flex-col justify-between overflow-hidden relative">
         <div className="absolute -top-10 -right-10 w-40 h-40 bg-slate-100 dark:bg-slate-800 rounded-full blur-3xl opacity-50" />
         
         <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-bold text-slate-900 dark:text-white">Proactive Nudges</h3>
               <TrendingUp size={20} className="text-emerald-500" />
            </div>

            <div className="space-y-6">
               {nudgesLoading ? (
                 <div className="space-y-4 animate-pulse">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="flex gap-4 items-center">
                       <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full" />
                       <div className="flex-1 space-y-2">
                         <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                         <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                       </div>
                     </div>
                   ))}
                 </div>
                ) : nudges && nudges.length > 0 ? nudges.map((nudge: any) => (
                  <div key={nudge.contact_id} className="flex items-start gap-4 group cursor-pointer">
                     <div className="relative shrink-0">
                       <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                         {(nudge.name || nudge.contact_name || 'U')[0]}
                       </div>
                       <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
                     </div>
                     <div className="flex-1">
                       <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight">{nudge.name || nudge.contact_name}</h4>
                       <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-medium line-clamp-2 italic italic">
                         "{nudge.reason || nudge.nudge_text}"
                       </p>
                       {(nudge.score !== undefined || nudge.health_score !== undefined) && (
                         <div className="mt-2 flex items-center gap-1.5">
                           <div className="h-1 w-12 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                             <div 
                               className={cn("h-full", (nudge.score || nudge.health_score) < 30 ? "bg-red-500" : (nudge.score || nudge.health_score) < 60 ? "bg-amber-500" : "bg-emerald-500")}
                                style={{ width: `${nudge.score || nudge.health_score}%` }}
                             />
                           </div>
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Health: {nudge.score || nudge.health_score}%</span>
                         </div>
                       )}
                     </div>
                  </div>
               )) : (
                 <div className="py-10 text-center space-y-3">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-50" />
                    <p className="text-sm font-medium text-slate-500">All relationships are healthy. You're winning!</p>
                 </div>
               )}
            </div>
         </div>

         <div className="relative z-10 mt-8 space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 border-dashed hover:border-blue-500/50 transition-all cursor-pointer">
               <div className="flex items-center gap-3 mb-2">
                 <AlertCircle size={14} className="text-blue-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Upcoming Milestone</span>
               </div>
               <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Project Horizon Alpha v1 Launch</p>
               <p className="text-[10px] text-slate-400 mt-1 italic">3 high-value contacts already briefed.</p>
            </div>
            <button className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Configure Alerts
            </button>
         </div>
      </div>
    </div>
  );
};

export default IntelligenceWorkbench;
