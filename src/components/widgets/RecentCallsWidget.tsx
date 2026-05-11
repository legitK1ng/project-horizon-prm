import React, { useState } from 'react';
import { PhoneCall, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCalls } from '../../hooks/useHorizonData';
import { cn } from '../../lib/utils';

interface Props {
  onContactSelect: (id: string, name: string) => void;
}

const RecentCallsWidget: React.FC<Props> = ({ onContactSelect }) => {
  const { data: calls } = useCalls();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const recent = (calls ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.timestamp ?? b.created_at ?? 0).getTime() -
        new Date(a.timestamp ?? a.created_at ?? 0).getTime(),
    )
    .slice(0, 5);

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const sentimentClass = (s?: string | null) => {
    if (s === 'Positive') return 'text-emerald-500';
    if (s === 'Negative') return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Calls</h3>
        <button
          onClick={() => navigate('/calls')}
          className="text-[10px] font-black text-blue-500 uppercase tracking-widest active:opacity-60"
        >
          See All →
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="p-6 text-center">
          <PhoneCall size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-semibold">No calls recorded yet</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {recent.map((call) => (
            <div key={call.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  className="flex-1 flex items-center gap-3 text-left active:opacity-70"
                  onClick={() => {
                    if (call.contact_id && call.contact_name) {
                      onContactSelect(call.contact_id, call.contact_name);
                    }
                  }}
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-blue-500">
                      {(call.contact_name?.[0] ?? '?').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {call.contact_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">{formatTime(call.timestamp)}</span>
                      {call.duration != null && (
                        <span className="text-[10px] text-slate-400">· {call.duration}s</span>
                      )}
                      {call.sentiment && (
                        <span className={cn('text-[10px] font-bold', sentimentClass(call.sentiment))}>
                          · {call.sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {(call.executive_brief?.summary || call.transcript) && (
                  <button
                    onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 active:opacity-60"
                  >
                    {expandedId === call.id ? (
                      <ChevronUp size={13} className="text-slate-500" />
                    ) : (
                      <ChevronDown size={13} className="text-slate-500" />
                    )}
                  </button>
                )}
              </div>

              {expandedId === call.id && (
                <div className="mt-2 space-y-2">
                  {call.executive_brief?.summary && (
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40">
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-1">
                        Executive Brief
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {call.executive_brief.summary}
                      </p>
                      {(call.executive_brief.action_items ?? []).length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {call.executive_brief.action_items!.map((item, i) => (
                            <li key={i} className="text-[10px] text-blue-600 dark:text-blue-400 flex gap-1.5">
                              <span>•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {call.transcript && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Transcript
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-6">
                        {call.transcript}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentCallsWidget;
