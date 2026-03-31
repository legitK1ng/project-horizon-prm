import React, { useMemo } from 'react';
import { AppView, ConnectionStatus } from '@/types';
import { APP_VIEW } from '@/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle, Command, TrendingUp, Network } from 'lucide-react';
import { cn } from '@/utils/ui';
import IntelligenceWorkbench from './IntelligenceWorkbench';
import RelationshipGraph from './common/RelationshipGraph';
import { GoogleSyncButton } from './common/GoogleSyncButton';
import NudgeShelf from './common/NudgeShelf';
import { useNudges, useCalls, useContacts } from '@/hooks/useHorizonData';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
  connectionStatus: ConnectionStatus;
}

const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  connectionStatus,
}) => {
  const { data: nudges } = useNudges();
  const { data: calls = [] } = useCalls();
  const { data: contacts = [] } = useContacts();

  // Memoize sorted briefs
  const recentBriefs = useMemo(() => {
    return [...calls]
      .filter((c) => c.executive_brief)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [calls]);

  // Smart Lists Logic (Real-ish)
  const smartLists = [
    { name: 'High Stakes', count: contacts.filter(c => (c.health_score ?? 0) > 80).length, icon: <TrendingUp size={14} />, color: 'text-blue-600' },
    { name: 'Needs Attention', count: nudges?.length || 0, icon: <AlertCircle size={14} />, color: 'text-amber-500' },
    { name: 'Pending Actions', count: 8, icon: <Command size={14} />, color: 'text-purple-500' },
  ];

  // Process data for the chart
  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    calls.forEach(call => {
      const date = new Date(call.timestamp);
      if (!isNaN(date.getTime())) counts[date.getDay()]++;
    });
    const rotatedDays = [...days.slice(1), days[0]];
    const rotatedCounts = [...counts.slice(1), counts[0]];
    return rotatedDays.map((day, index) => ({ day, calls: rotatedCounts[index] }));
  }, [calls]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header Area */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
            Command Center
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium flex items-center gap-2">
            <span className={cn("inline-block w-2 h-2 rounded-full animate-pulse", 
              connectionStatus === 'connected' ? "bg-emerald-500" : "bg-amber-500"
            )} />
            {connectionStatus === 'connected' ? 'Intelligence Engine Active' : 'Intelligence Processing'}
          </p>
        </div>
        <div className="flex items-center gap-4">
           {/* Smart Lists Pills */}
           <div className="hidden lg:flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
             {smartLists.map(list => (
               <button key={list.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm">
                 <span className={list.color}>{list.icon}</span>
                 <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{list.name}</span>
                 <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-md opacity-60">{list.count}</span>
               </button>
             ))}
           </div>
            <GoogleSyncButton userId="demo-user-horizon-prm" />
           <button
            onClick={() => onNavigate(APP_VIEW.LAB)}
            className="btn-primary flex items-center gap-2"
          >
            <span>+ New Pulse</span>
          </button>
        </div>
      </header>

       {/* Primary Intelligence Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Weekly Engagement Chart */}
        <div className="xl:col-span-2 card p-8 border-none shadow-glow bg-white dark:bg-slate-900 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Engagement Velocity</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Past 7 Days</p>
            </div>
            <div className="text-right flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                 <Network size={16} className="text-blue-500" />
              </div>
              <div>
                 <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{calls.length}</p>
                 <p className="text-[10px] text-slate-400 uppercase font-bold">Total Pulses</p>
              </div>
            </div>
          </div>
          <div className="h-64 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.05} vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 87, 255, 0.05)', radius: 8 }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: 'var(--shadow-xl)',
                    backgroundColor: 'hsl(var(--surface-overlay))',
                    padding: '12px'
                  }}
                />
                <Bar dataKey="calls" radius={[8, 8, 8, 8]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.calls > 0 ? 'hsl(var(--horizon-primary))' : 'hsl(var(--surface-raised))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Intelligence Workbench */}
        <IntelligenceWorkbench />
      </div>

      {/* Proactive Intelligence Shelf */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Active Relationship Nudges</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Intelligence-Led Priorities</p>
          </div>
        </div>
        <NudgeShelf />
      </section>

      {/* Relationship Visualization & Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
         <RelationshipGraph />
         
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="card p-8 bg-white dark:bg-slate-900 border-none shadow-md flex flex-col justify-center relative overflow-hidden group/health">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 group-hover/health:bg-blue-500/10 transition-colors" />
               <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                 {(contacts.reduce((acc, c) => acc + (c.health_score ?? 0), 0) / (contacts.length || 1)).toFixed(1)}
               </h4>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Overall Health Score</p>
               <div className="mt-4 flex items-center gap-2 text-emerald-500 font-bold text-sm">
                  <TrendingUp size={14} />
                  <span>Verified Signals</span>
               </div>
            </div>
            
            <div className="card p-8 bg-blue-600 text-white border-none shadow-md flex flex-col justify-center">
                <h4 className="text-3xl font-black tracking-tighter">14</h4>
                <p className="text-xs font-bold text-white/70 uppercase tracking-widest mt-2">Open Commitments</p>
                <button className="mt-4 text-xs font-black uppercase text-white/50 hover:text-white transition-colors">Resolve Now →</button>
            </div>
         </div>
      </div>

      {/* Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Latest Executive Briefs (Re-styled) */}
        <div className="lg:col-span-2 card p-8 bg-white dark:bg-slate-900 border-none shadow-md flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Cognitive Briefs</h3>
            <button
               onClick={() => onNavigate(APP_VIEW.LOGS)}
               className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
            >
              View Feed
            </button>
          </div>
          <div className="space-y-4 flex-1">
            {recentBriefs.map((brief) => (
              <div
                key={brief.id}
                className="group p-5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl hover:border-blue-500/30 transition-all cursor-pointer"
                onClick={() => onNavigate(APP_VIEW.LOGS)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {new Date(brief.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                  </span>
                  {brief.executive_brief?.tags?.slice(0, 1).map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-3 py-1 bg-blue-500 text-white rounded-full font-bold uppercase tracking-tighter"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition leading-tight mb-2">
                  {brief.executive_brief?.title ?? 'Strategic Pulse'}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {brief.executive_brief?.summary ?? 'No summary available.'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence Workbench */}
        <IntelligenceWorkbench />
      </div>
    </div>
  );
};

export default Dashboard;
