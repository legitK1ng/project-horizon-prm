import React, { useMemo } from 'react';
import { CallRecord, Contact, AppView, ConnectionStatus } from '@/types';
import { APP_VIEW, ICONS } from '@/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle } from 'lucide-react';

interface DashboardProps {
  calls: CallRecord[];
  contacts: Contact[];
  onNavigate: (view: AppView) => void;
  connectionStatus: ConnectionStatus;
}

const Dashboard: React.FC<DashboardProps> = ({
  calls,
  contacts,
  onNavigate,
  connectionStatus,
}) => {
  // Memoize sorted briefs to prevent re-sorting on every render
  const recentBriefs = useMemo(() => {
    return [...calls]
      .filter((c) => c.executiveBrief)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [calls]);

  const statsData = [
    {
      name: 'Calls',
      value: calls.length,
      icon: ICONS.Logs,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      view: APP_VIEW.LOGS,
    },
    {
      name: 'Contacts',
      value: contacts.length,
      icon: ICONS.Contacts,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      view: APP_VIEW.CONTACTS,
    },
    {
      name: 'Briefs',
      value: calls.filter((c) => c.executiveBrief).length,
      icon: ICONS.Dashboard,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      view: APP_VIEW.ACTIONS,
    },
  ];

  // Process data for the chart (Aggregate calls by day of week)
  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);

    calls.forEach(call => {
      const date = new Date(call.timestamp);
      if (!isNaN(date.getTime())) {
        counts[date.getDay()]++;
      }
    });

    // Rotate so Monday is first (optional, but standard for business apps)
    // 0=Sun, 1=Mon... 
    // We want Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const rotatedDays = [...days.slice(1), days[0]];
    const rotatedCounts = [...counts.slice(1), counts[0]];

    return rotatedDays.map((day, index) => ({
      day,
      calls: rotatedCounts[index]
    }));
  }, [calls]);

  // Find max value for chart scaling (optional, if we needed custom domain)
  // const maxCalls = Math.max(...chartData.map(d => d.calls), 5); // min 5 for scale

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Executive Summary
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Intelligent relationship management at your fingertips.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => onNavigate(APP_VIEW.LAB)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-md shadow-blue-100 dark:shadow-none flex items-center space-x-2"
          >
            <span className="text-lg">+</span>
            <span>New Brief</span>
          </button>
        </div>
      </header>

      {/* Connection Status Banner */}
      {connectionStatus === 'offline' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-4">
          <div className="text-amber-600 dark:text-amber-400 mt-1">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm uppercase tracking-wide mb-1">
              Connection Alert
            </h4>
            <p className="text-amber-700 dark:text-amber-500 text-sm mb-2">
              The app is using Mock Data because connection to Google failed. Check your backend
              configuration.
            </p>
            <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg text-xs font-mono text-amber-900 dark:text-amber-300">
              <strong className="block mb-1">Fix "Access Denied / 403":</strong>
              1. Go to Apps Script Editor → Deploy → Manage Deployments
              <br />
              2. Edit current version (Pencil icon)
              <br />
              3. Set "Who has access" to "Anyone"
              <br />
              4. Redeploy and update VITE_BACKEND_URL in .env.local
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statsData.map((stat, idx) => (
          <div
            key={idx}
            onClick={() => onNavigate(stat.view)}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:bg-opacity-80 transition`}>{stat.icon}</div>
              <div className="flex items-center text-emerald-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Placeholder for real trends if needed later */}
                View &rarr;
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.name}</p>
            <h4 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
              {stat.value}
            </h4>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Activity Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center space-x-2">
            <span>Weekly Engagement</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-normal uppercase tracking-wider ${connectionStatus === 'connected'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
            >
              {connectionStatus === 'connected' ? 'Live Data' : 'Mock Data'}
            </span>
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: '#fff',
                  }}
                />
                <Bar dataKey="calls" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    // Highlight current day? Or just keep blue. Let's keep one color mostly.
                    <Cell key={`cell-${index}`} fill={entry.calls > 0 ? '#2563eb' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Briefs */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Latest Briefs</h3>
            <button
              onClick={() => onNavigate(APP_VIEW.LOGS)}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              View all
            </button>
          </div>
          <div className="space-y-4 flex-1">
            {recentBriefs.map((brief) => (
              <div
                key={brief.id}
                className="group p-4 rounded-xl border border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                onClick={() => onNavigate(APP_VIEW.LOGS)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {new Date(brief.timestamp).toLocaleDateString()}
                  </span>
                  <div className="flex items-center space-x-1">
                    {brief.executiveBrief?.tags?.slice(0, 1).map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate">
                  {brief.executiveBrief?.title ?? 'Untitled Brief'}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                  {brief.executiveBrief?.summary ?? 'No summary available.'}
                </p>
              </div>
            ))}
            {recentBriefs.length === 0 && (
              <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                <div className="text-slate-300 mb-2">{ICONS.Logs}</div>
                <p className="text-slate-400 text-sm">No briefings generated yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
