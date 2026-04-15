import React, { useState, useEffect } from "react";
import {
  Users,
  PhoneCall,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Search,
  BrainCircuit,
  Sparkles,
  Cloud
} from "lucide-react";

import RelationshipGraph from "./common/RelationshipGraph";
import NudgeShelf from "./common/NudgeShelf";
import CommandPalette from "./CommandPalette";
import CallLog from "./CallLog";
import LoadingScreen from "./LoadingScreen";
import {
  useContacts,
  useCalls,
  useNudges,
  useStats,
  useRefreshHealth,
  useSyncGoogleContacts
} from "../hooks/useHorizonData";
import UnifiedContactDrawer from "./common/UnifiedContactDrawer";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const Dashboard: React.FC = () => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);
  const navigate = useNavigate();

  // REQ-022: Multi-step data fetching with TanStack Query
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const { data: calls, isLoading: callsLoading } = useCalls();
  const { data: nudges, isLoading: nudgesLoading } = useNudges();
  const { data: stats, isLoading: statsLoading } = useStats();

  const refreshHealth = useRefreshHealth();
  const syncContacts = useSyncGoogleContacts();

  const handleCommandShortcut = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setIsCommandPaletteOpen(prev => !prev);
    }
  };

  // FIX: Include isCommandPaletteOpen in deps to avoid stale closure
  useEffect(() => {
    window.addEventListener("keydown", handleCommandShortcut);
    return () => window.removeEventListener("keydown", handleCommandShortcut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommandPaletteOpen]);

  const handleSync = async () => {
    const toastId = toast.loading("Syncing with Google Contacts...");
    try {
      // PROD: We need a valid token here. 
      // For now, we take from local storage or prompt user.
      const token = localStorage.getItem('google_access_token') || '';
      const result: any = await syncContacts.mutateAsync({ userId: 'default', accessToken: token });
      toast.success(`Google Sync complete: ${result?.stats?.updated ?? '?'} contacts updated`, { id: toastId });
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error.message || 'Unknown error';
      toast.error(`Sync failed: ${detail}`, { id: toastId });
    }
  };

  if (contactsLoading || callsLoading || nudgesLoading || statsLoading) {
    return <LoadingScreen />;
  }

  const onNavigate = (view: any) => {
    console.log('Navigate to', view);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 🟢 TOP BAR — STATS & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Relationship Command Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Proactive intelligence for your elite network.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 transition-all shadow-sm text-sm font-medium"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Search or command...</span>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 ml-2 text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 uppercase font-bold tracking-wider">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} K
            </span>
          </button>

          <button
            onClick={handleSync}
            disabled={syncContacts.isPending}
            className="p-2 text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 disabled:opacity-50"
            title="Sync with Google Contacts"
          >
            <Cloud className={`w-5 h-5 ${syncContacts.isPending ? 'animate-bounce' : ''}`} />
          </button>

          <button
            onClick={() => refreshHealth.mutate(undefined)}
            disabled={refreshHealth.isPending}
            className="p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800 disabled:opacity-50"
            title="Refresh Health Scores"
          >
            <RefreshCw className={`w-5 h-5 ${refreshHealth.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 📊 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Network Size", val: stats?.totalContacts || 0, color: "blue", path: "/contacts" },
          { icon: PhoneCall, label: "Active Calls", val: stats?.callsThisWeek || 0, color: "emerald", path: "/calls" },
          { icon: AlertCircle, label: "Needs Review", val: stats?.needsAttention || 0, color: "amber", path: "/contacts?filter=attention" },
          { icon: TrendingUp, label: "Avg. Health", val: `${stats?.avgHealth || 0}%`, color: "purple", path: "/contacts?sort=health" }
        ].map((kpi, i) => (
          <button
            key={i}
            onClick={() => navigate(kpi.path)}
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-500/50 transition-all group text-left w-full"
          >
            <div className="flex justify-between items-start">
              <div className={`p-2 rounded-xl bg-${kpi.color}-50 dark:bg-${kpi.color}-950 text-${kpi.color}-600 dark:text-${kpi.color}-400`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
              <h3 className="text-2xl font-bold mt-0.5">{kpi.val}</h3>
            </div>
          </button>
        ))}
      </div>

      {/* 🏗️ MAIN INTELLIGENCE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Insights & Relationships */}
        <div className="lg:col-span-2 space-y-8">
          {/* Relationship Map */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="text-blue-500" size={24} />
                  Relationship Intelligence
                </h3>
                <p className="text-slate-500 text-sm mt-1">Topology v1: Professional Network View</p>
              </div>
            </div>
            <RelationshipGraph contacts={contacts ?? []} calls={calls ?? []} />
          </div>

          {/* MOST CONTACTED */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
                Most Contacted
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(contacts || [])
                .filter(c => (c.total_calls || 0) > 0)
                .sort((a, b) => (b.total_calls || 0) - (a.total_calls || 0))
                .slice(0, 6)
                .map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSelectedContactId(contact.id);
                      setSelectedContactName(`${contact.first_name} ${contact.last_name || ''}`.trim());
                    }}
                    className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-all group text-left border border-slate-100 dark:border-slate-800 hover:border-blue-500/30"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm shrink-0">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-lg">
                          {contact.first_name[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-500 transition-colors">
                        {contact.first_name} {contact.last_name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {contact.total_calls} Interactions
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Recent Call Records */}
          <CallLog />
        </div>

        {/* RIGHT COLUMN: AI Tasks & Proactive Nudges */}
        <div className="space-y-8">
          {/* Proactive AI Shelf */}
          <div className="bg-slate-900 dark:bg-black rounded-3xl p-8 shadow-xl border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
              <BrainCircuit size={80} className="text-blue-500" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                <Sparkles className="text-amber-400" size={24} />
                Strategic Nudges
              </h3>
              <NudgeShelf nudges={nudges ?? []} />
            </div>
          </div>

          {/* INNER CIRCLE (FAVORITES) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Inner Circle
              </h2>
            </div>
            <div className="space-y-3">
              {(contacts || [])
                .filter(c => c.is_favorite)
                .slice(0, 5)
                .map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSelectedContactId(contact.id);
                      setSelectedContactName(`${contact.first_name} ${contact.last_name || ''}`.trim());
                    }}
                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all group text-left border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm shrink-0">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-sm">
                          {contact.first_name[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-500 transition-colors">
                        {contact.first_name} {contact.last_name}
                      </h4>
                    </div>
                  </button>
                ))}
              {(contacts || []).filter(c => c.is_favorite).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4 italic">No favorites yet.</p>
              )}
            </div>
          </div>

          {/* Health Score Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Network Health</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Stability Index</span>
                <span className="text-emerald-500 font-bold">{stats?.avgHealth || 0}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${stats?.avgHealth || 0}%` }} />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">
                "Your average network health is {stats?.avgHealth || 0}%. Proactive engagement recommended for low-scoring entities."
              </p>
            </div>
          </div>
        </div>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={onNavigate}
        calls={calls ?? []}
        contacts={contacts ?? []}
      />

      {/* Unified Contact Drawer */}
      {selectedContactName && (
        <UnifiedContactDrawer
          contactId={selectedContactId}
          contactName={selectedContactName}
          contacts={contacts || []}
          calls={calls || []}
          onClose={() => {
            setSelectedContactId(null);
            setSelectedContactName(null);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
