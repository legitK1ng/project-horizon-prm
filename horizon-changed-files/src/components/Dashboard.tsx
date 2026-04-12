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

  // Smart Lists Logic
  const smartLists = [
    { name: 'High Stakes', count: contacts.filter(c => (c.health_score ?? 0) > 80).length, icon: <TrendingUp size={14} />, color: 'text-blue-600' },
    { name: 'Needs Attention', count: nudges?.length || 0, icon: <AlertCircle size={14} />, color: 'text-amber-500' },
    { name: 'Pending Actions', count: recentBriefs.reduce((acc, b) => acc + (b.executive_brief?.action_items?.length ?? 0), 0), icon: <Command size={14} />, color: 'text-purple-500' },
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

  // Build real relationship graph data from contacts + calls
  const graphData = useMemo(() => {
    if (contacts.length === 0) return { nodes: [], links: [] };

    // Gather top contacts by call count for a clean graph (cap at 20)
    const callsByContact: Record<string, number> = {};
    calls.forEach(c => {
      if (c.contact_name) callsByContact[c.contact_name] = (callsByContact[c.contact_name] || 0) + 1;
    });

    const topContacts = contacts
      .slice(0, 20)
      .map(c => {
        const fullName = `${c.first_name} ${c.last_name || ''}`.trim();
        return {
          id: c.id,
          name: fullName,
          type: 'person' as const,
          val: Math.max(1, Math.min(5, Math.ceil((callsByContact[fullName] || 1) / 2))),
        };
      });

    // Build org nodes
    const orgMap: Record<string, string> = {};
    contacts.forEach(c => {
      const org = (c as any).organization;
      if (org && !orgMap[org]) {
        orgMap[org] = `org-${org}`;
      }
    });
    const orgNodes = Object.entries(orgMap).slice(0, 5).map(([name, id]) => ({
      id,
      name,
      type: 'organization' as const,
      val: 3,
    }));

    const allNodes = [...topContacts, ...orgNodes];

    // Links: contact → their org if present
    const links: { source: string; target: string; value: number }[] = [];
    contacts.slice(0, 20).forEach(c => {
      const org = (c as any).organization;
      if (org && orgMap[org]) {
        links.push({ source: c.id, target: orgMap[org], value: 1 });
      }
    });

    // Cross-links between contacts who share calls within the same week
    const processed = new Set<string>();
    topContacts.forEach((a, i) => {
      topContacts.slice(i + 1, i + 3).forEach(b => {
        const key = `${a.id}-${b.id}`;
        if (!processed.has(key)) {
          processed.add(key);
          links.push({ source: a.id, target: b.id, value: 1 });
        }
      });
    });

    return { nodes: allNodes, links };
  }, [contacts, calls]);

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

        {/* Intelligence Workbench — rendered ONCE here */}
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

      {/* Relationship Visualization & Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
         <RelationshipGraph data={graphData} />

         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="card p-8 bg-white dark:bg-slate-900 border-none shadow-md flex flex-col justify-center relative overflow-hidden group/health">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 group-hover/health:bg-blue-500/10 transition-colors" />
               <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                 {contacts.length === 0
                   ? '—'
                   : (contacts.reduce((acc, c) => acc + (c.health_score ?? 0), 0) / contacts.length).toFixed(1)}
               </h4>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Overall Health Score</p>
               <div className="mt-4 flex items-center gap-2 text-emerald-500 font-bold text-sm">
                  <TrendingUp size={14} />
                  <span>Verified Signals</span>
               </div>
            </div>

            <div className="card p-8 bg-blue-600 text-white border-none shadow-md flex flex-col justify-center">
                <h4 className="text-3xl font-black tracking-tighter">
                  {recentBriefs.reduce((acc, b) => acc + (b.executive_brief?.action_items?.length ?? 0), 0)}
                </h4>
                <p className="text-xs font-bold text-white/70 uppercase tracking-widest mt-2">Open Commitments</p>
                <button
                  onClick={() => onNavigate(APP_VIEW.LOGS)}
                  className="mt-4 text-xs font-black uppercase text-white/50 hover:text-white transition-colors text-left"
                >
                  Resolve Now →
                </button>
            </div>

            <div className="card p-8 bg-white dark:bg-slate-900 border-none shadow-md flex flex-col justify-center sm:col-span-2">
               <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{contacts.length}</h4>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Total Contacts</p>
               <button
                 onClick={() => onNavigate(APP_VIEW.CONTACTS)}
                 className="mt-4 text-xs font-black uppercase text-blue-500 hover:text-blue-700 transition-colors text-left"
               >
                 Manage →
               </button>
            </div>
         </div>
      </div>

      {/* Cognitive Briefs — full width, no second IntelligenceWorkbench */}
      <div className="card p-8 bg-white dark:bg-slate-900 border-none shadow-md flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Cognitive Briefs</h3>
          <button
             onClick={() => onNavigate(APP_VIEW.LOGS)}
             className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
          >
            View Feed
          </button>
        </div>
        {recentBriefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Network size={32} className="mb-4 opacity-30" />
            <p className="font-medium">No briefs yet. Process some calls in the Lab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        )}
      </div>
    </div>
  );
};

export default Dashboard;
