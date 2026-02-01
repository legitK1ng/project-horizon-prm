
import React from 'react';
import { CallRecord, Contact, AppView } from '../types';
import { ICONS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle } from 'lucide-react';

interface DashboardProps {
  calls: CallRecord[];
  contacts: Contact[];
  onNavigate: (view: AppView) => void;
  connectionStatus?: 'connected' | 'offline'; // Added prop
}

const Dashboard: React.FC<DashboardProps> = ({ calls, contacts, onNavigate, connectionStatus = 'offline' }) => {
  const recentBriefs = calls.filter(c => c.executiveBrief).slice(0, 3);
  
  const statsData = [
    { name: 'Calls', value: calls.length, icon: ICONS.Logs, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { name: 'Contacts', value: contacts.length, icon: ICONS.Contacts, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { name: 'Briefs', value: calls.filter(c => c.executiveBrief).length, icon: ICONS.Dashboard, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ];

  // Dummy chart data
  const chartData = [
    { day: 'Mon', calls: 3 },
    { day: 'Tue', calls: 5 },
    { day: 'Wed', calls: 2 },
    { day: 'Thu', calls: 8 },
    { day: 'Fri', calls: 4 },
    { day: 'Sat', calls: 1 },
    { day: 'Sun', calls: 2 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Executive Summary</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Intelligent relationship management at your fingertips.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => onNavigate(AppView.LAB)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-md shadow-blue-100 dark:shadow-none flex items-center space-x-2"
          >
            <span className="text-lg">+</span>
            <span>New Brief</span>
          </button>
        </div>
      </header>

      {/* Troubleshooting Banner for Offline Mode */}
      {connectionStatus === 'offline' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-4">
          <div className="text-amber-600 dark:text-amber-400 mt-1">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm uppercase tracking-wide mb-1">Connection Alert</h4>
            <p className="text-amber-700 dark:text-amber-500 text-sm mb-2">
              The app is using Mock Data because the connection to Google failed. If your phone app is also showing a 403 error, your script permissions are incorrect.
            </p>
            <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg text-xs font-mono text-amber-900 dark:text-amber-300">
              <strong className="block mb-1">To Fix "Access Denied / 403":</strong>
              1. Go to Google Apps Script Editor &gt; Deploy &gt; Manage Deployments.<br/>
              2. Edit current version (Pencil icon).<br/>
              3. Set <strong>Who has access</strong> to <strong>"Anyone"</strong>.<br/>
              4. Redeploy.
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statsData.map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                {stat.icon}
              </div>
              <div className="flex items-center text-emerald-500 text-sm font-medium">
                {ICONS.Trend}
                <span className="ml-1">+12%</span>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.name}</p>
            <h4 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{stat.value}</h4>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Activity Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center space-x-2">
            <span>Weekly Engagement</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-normal uppercase tracking-wider ${connectionStatus === 'connected' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
              {connectionStatus === 'connected' ? 'Live Data' : 'Mock Data'}
            </span>
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 12}}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#fff'}}
                />
                <Bar dataKey="calls" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 3 ? '#2563eb' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Briefs */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Latest Briefs</h3>
            <button 
              onClick={() => onNavigate(AppView.LOGS)}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              View all
            </button>
          </div>
          <div className="space-y-4">
            {recentBriefs.map(brief => (
              <div 
                key={brief.id} 
                className="group p-4 rounded-xl border border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {new Date(brief.timestamp).toLocaleDateString()}
                  </span>
                  <div className="flex items-center space-x-1">
                    {brief.executiveBrief?.tags.slice(0, 1).map((tag, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate">
                  {brief.executiveBrief?.title}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                  {brief.executiveBrief?.summary}
                </p>
              </div>
            ))}
            {recentBriefs.length === 0 && (
              <div className="text-center py-12">
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
