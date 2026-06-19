import React from "react";
import {
  Clock,
  ArrowRight,
  TrendingUp,
  Mail,
  Phone
} from "lucide-react";
import { Nudge } from "../../types";
import { useRefreshHealth } from "../../hooks/useHorizonData";
import toast from "react-hot-toast";

interface NudgeShelfProps {
  nudges: Nudge[];
}

const NudgeShelf: React.FC<NudgeShelfProps> = ({ nudges }) => {
  const refreshHealth = useRefreshHealth();

  const handleRefresh = async (contactId: string) => {
    try {
      await refreshHealth.mutateAsync(contactId);
      toast.success("Health score recalculated");
    } catch {
      toast.error("Failed to refresh score");
    }
  };

  if (!nudges || nudges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-400">All caught up. No nudges for now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {nudges.map((nudge) => (
        <div
          key={nudge.id}
          className="group p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-blue-200 dark:hover:border-blue-900 transition-all hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-blue-500/20">
                {nudge.contact_name.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-semibold group-hover:text-blue-500 transition-colors uppercase tracking-tight">
                  {nudge.contact_name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${nudge.type === 'FOLLOW_UP' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>
                    {nudge.type?.replace('_', ' ') || 'ACTION'}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3" />
                    {nudge.due_in}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleRefresh(nudge.id)}
              className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
              title="Manual Health Refresh"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            {nudge.reason}
          </p>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => nudge.email && window.open(`mailto:${nudge.email}`, '_blank')}
              disabled={!nudge.email}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Mail className="w-3 h-3" />
              Email
            </button>
            <button
              onClick={() => nudge.phone && window.open(`tel:${nudge.phone}`, '_blank')}
              disabled={!nudge.phone}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Phone className="w-3 h-3" />
              Call
            </button>
            <button
              className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all active:scale-90"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NudgeShelf;
