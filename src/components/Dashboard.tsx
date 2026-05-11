import React, { useState, useEffect, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { motion, AnimatePresence } from "framer-motion";
import WidgetGrid from "./WidgetGrid";
import {
  Users,
  PhoneCall,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Search,
  BrainCircuit,
  Sparkles,
  Cloud,
  ChevronRight
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import RelationshipGraph from "./common/RelationshipGraph";
import NudgeShelf from "./common/NudgeShelf";
import CommandPalette from "./CommandPalette";
import CallLog from "./CallLog";
import Skeleton from "./common/Skeleton";
import GlassCard from "./common/GlassCard";
import PremiumButton from "./common/PremiumButton";
import { cn } from "../lib/utils";
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
import Sentinel from "./Sentinel";
import SystemBots from "./SystemBots";
import NetworkTopology from "./NetworkTopology";

const Dashboard: React.FC = () => {
  const isMobile = Capacitor.isNativePlatform();

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

  useEffect(() => {
    window.addEventListener("keydown", handleCommandShortcut);
    return () => window.removeEventListener("keydown", handleCommandShortcut);
  }, [isCommandPaletteOpen]);

  const handleSync = async () => {
    const toastId = toast.loading("Syncing with Google Contacts...");
    try {
      const token = localStorage.getItem('google_access_token') || '';
      const result: any = await syncContacts.mutateAsync({ userId: 'default', accessToken: token });
      toast.success(`Google Sync complete: ${result?.stats?.updated ?? '?'} contacts updated`, { id: toastId });
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error.message || 'Unknown error';
      toast.error(`Sync failed: ${detail}`, { id: toastId });
    }
  };

  const callFrequencyData = useMemo(() => {
    const days: { date: string; calls: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayStr = d.toISOString().slice(0, 10);
      const count = (calls || []).filter((c) => {
        const ts = (c.timestamp || c.created_at || '').slice(0, 10);
        return ts === dayStr;
      }).length;
      days.push({ date: label, calls: count });
    }
    return days;
  }, [calls]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { 
        type: 'spring', 
        stiffness: 100, 
        damping: 15,
        mass: 1
      } as const,
    },
  };

  // On native (APK) hand off to the mobile widget grid — no loading gate needed there
  if (isMobile) return <WidgetGrid />;

  if (contactsLoading || callsLoading || nudgesLoading || statsLoading) {
    return (
      <div className="space-y-12 pb-12 animate-in fade-in duration-500 max-w-[1600px] mx-auto px-6">
        <div className="flex justify-between items-center px-2 pt-12">
          <div className="space-y-4">
            <Skeleton variant="text" className="h-20 w-96" />
            <Skeleton variant="text" className="h-8 w-64" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-14 w-48 rounded-[1.5rem]" />
            <Skeleton className="h-14 w-32 rounded-[1.5rem]" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-[2.5rem]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <Skeleton className="lg:col-span-2 h-[600px] rounded-[2.5rem]" />
          <Skeleton className="h-[600px] rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-16 pb-20 pt-12 relative max-w-[1600px] mx-auto px-6"
    >
      {/* 🌌 Atmospheric Background Elements */}
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 pointer-events-none -z-20" />
      <div className="fixed inset-0 bg-carbon opacity-[0.03] dark:opacity-[0.08] pointer-events-none -z-10" />
      <div className="fixed inset-0 bg-grid opacity-[0.05] dark:opacity-[0.1] pointer-events-none -z-10" />
      
      {/* Dynamic Orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, 30, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="fixed top-[-10%] right-[-10%] w-[1000px] h-[1000px] bg-blue-600/5 blur-[180px] rounded-full pointer-events-none -z-10" 
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          x: [0, -50, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="fixed bottom-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-emerald-500/5 blur-[180px] rounded-full pointer-events-none -z-10" 
      />

      {/* 🟢 NAVIGATION & COMMAND SECTION */}
      <motion.div variants={itemVariants} className="flex flex-col 2xl:flex-row justify-between items-start 2xl:items-end gap-16">
        <div className="relative group">
          <div className="flex items-center gap-6 mb-6">
            <span className="text-[12px] font-black uppercase tracking-[0.5em] text-blue-500 italic flex items-center gap-3">
              <div className="w-8 h-[2px] bg-blue-500" />
              Horizon_OS v2.5.0
            </span>
            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">Live_Sync</span>
            </div>
          </div>
          
          <h1 className="text-6xl lg:text-8xl font-black tracking-[-0.05em] leading-[0.8] italic uppercase mb-8 transition-all duration-1000 group-hover:tracking-[-0.06em]">
            <span className="block text-slate-950 dark:text-white overflow-hidden">
              <motion.span 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                Network
              </motion.span>
            </span>
            <span className="block text-blue-500 not-italic overflow-hidden">
              <motion.span 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                Intelligence
              </motion.span>
            </span>
          </h1>
          
          <div className="flex flex-wrap items-center gap-6">
            <p className="text-slate-500 dark:text-slate-400 text-lg lg:text-xl font-medium leading-relaxed max-w-2xl border-l-[3px] border-blue-500 pl-6 lg:pl-8 py-2">
              Orchestrating <span className="text-slate-950 dark:text-white font-black italic underline decoration-blue-500/30 decoration-[8px] underline-offset-[12px]">{stats?.totalContacts || 0}</span> high-value strategic relationships. 
              <br />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600 mt-4 block">Security Protocol: Level_5_Stealth</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 w-full 2xl:w-auto self-stretch 2xl:self-auto">
          <motion.div className="relative flex-1 2xl:w-[400px]">
            <motion.button
              onClick={() => setIsCommandPaletteOpen(true)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 px-6 lg:px-8 py-4 lg:py-5 rounded-[2rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200 dark:border-white/5 shadow-2xl-premium transition-all text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:border-blue-500/40 w-full"
            >
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <Search className="w-5 h-5 text-blue-500" />
              </div>
              <span className="flex-1 text-left italic uppercase tracking-[0.2em] font-black text-xs">Access Global Command...</span>
              <div className="flex items-center gap-2">
                <kbd className="hidden sm:inline-flex items-center gap-1 px-4 py-2 bg-slate-950 text-white rounded-2xl border border-white/10 text-[10px] font-black tracking-widest shadow-lg">
                  {navigator.platform.includes("Mac") ? "⌘" : "CTRL"}
                </kbd>
                <kbd className="hidden sm:inline-flex items-center gap-1 px-4 py-2 bg-slate-950 text-white rounded-2xl border border-white/10 text-[10px] font-black tracking-widest shadow-lg">
                  K
                </kbd>
              </div>
            </motion.button>
          </motion.div>

          <div className="flex gap-3">
            <PremiumButton
              variant="secondary"
              size="lg"
              onClick={handleSync}
              loading={syncContacts.isPending}
              className="rounded-[1.5rem] flex-1 px-6 h-[60px] border border-slate-200 dark:border-white/5"
            >
              <div className="flex items-center gap-3">
                <Cloud className={cn("w-4 h-4", syncContacts.isPending && "animate-bounce")} />
                <span className="italic uppercase tracking-[0.2em] font-black text-[10px]">Uplink</span>
              </div>
            </PremiumButton>

            <PremiumButton
              variant="secondary"
              size="lg"
              onClick={() => refreshHealth.mutate(undefined)}
              loading={refreshHealth.isPending}
              className="rounded-[1.5rem] flex-1 px-6 h-[60px] border border-slate-200 dark:border-white/5"
            >
              <div className="flex items-center gap-3">
                <RefreshCw className={cn("w-4 h-4", refreshHealth.isPending && "animate-spin")} />
                <span className="italic uppercase tracking-[0.2em] font-black text-[10px]">Sync</span>
              </div>
            </PremiumButton>
          </div>
        </div>
      </motion.div>

      {/* 📊 CORE TELEMETRY (KPI CARDS) */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {[
          { icon: Users, label: "Network Capacity", val: stats?.totalContacts || 0, color: "blue", path: "/contacts", trend: "+12% VELOCITY", desc: "Connected Nodes" },
          { icon: PhoneCall, label: "Signal Intensity", val: stats?.callsThisWeek || 0, color: "emerald", path: "/calls", trend: "PEAK FREQUENCY", desc: "Weekly Interaction" },
          { icon: AlertCircle, label: "Critical Reviews", val: stats?.needsAttention || 0, color: "amber", path: "/contacts?filter=attention", trend: "ACTION REQUIRED", desc: "Fading Connections" },
          { icon: TrendingUp, label: "Network Health", val: `${stats?.avgHealth || 0}%`, color: "purple", path: "/contacts?sort=health", trend: "OPTIMAL STATE", desc: "Relationship Index" }
        ].map((kpi, i) => (
          <GlassCard
            key={i}
            onClick={() => navigate(kpi.path)}
            className="p-8 lg:p-10 cursor-pointer group hover:scale-[1.02] transition-all duration-700 active:scale-95"
          >
            <div className="flex justify-between items-start mb-8 lg:mb-10">
              <div className={cn(
                "p-4 rounded-2xl transition-all duration-1000 transform group-hover:rotate-[360deg] shadow-xl",
                kpi.color === 'blue' && "bg-blue-600 text-white shadow-blue-600/30",
                kpi.color === 'emerald' && "bg-emerald-600 text-white shadow-emerald-600/30",
                kpi.color === 'amber' && "bg-amber-600 text-white shadow-amber-600/30",
                kpi.color === 'purple' && "bg-purple-600 text-white shadow-purple-600/30",
              )}>
                <kpi.icon className="w-8 h-8" />
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-[0.4em] italic",
                  kpi.color === 'blue' ? "text-blue-500" : 
                  kpi.color === 'emerald' ? "text-emerald-500" :
                  kpi.color === 'amber' ? "text-amber-500" : "text-purple-500"
                )}>
                  {kpi.trend}
                </span>
                <div className="h-1.5 w-10 bg-slate-200 dark:bg-slate-800 mt-3 ml-auto group-hover:w-20 transition-all duration-1000 rounded-full" />
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] lg:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] italic mb-2">{kpi.label}</p>
              <h3 className="text-5xl lg:text-6xl font-black text-slate-950 dark:text-white tracking-tighter leading-none group-hover:text-blue-500 transition-colors duration-700">
                {kpi.val}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 opacity-0 group-hover:opacity-100 transition-all duration-1000 translate-y-2 group-hover:translate-y-0">
                {kpi.desc}
              </p>
            </div>
            
            {/* Background Accent */}
            <div className={cn(
              "absolute -bottom-10 -right-10 w-40 h-40 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-1000 group-hover:scale-150 group-hover:rotate-12",
              kpi.color === 'blue' && "text-blue-500",
              kpi.color === 'emerald' && "text-emerald-500",
              kpi.color === 'amber' && "text-amber-500",
              kpi.color === 'purple' && "text-purple-500",
            )}>
              <kpi.icon className="w-full h-full" />
            </div>
          </GlassCard>
        ))}
      </motion.div>

      {/* 🛡️ SYSTEM GUARDIAN & AUTONOMOUS AGENTS */}
      <motion.div variants={itemVariants} className="space-y-8 lg:space-y-12">
        <div className="flex items-center gap-6 px-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40 animate-pulse" />
              <div className="h-3 w-3 rounded-full bg-blue-500 relative z-10 shadow-glow border-2 border-white" />
            </div>
            <h2 className="text-3xl lg:text-4xl font-black italic tracking-tight uppercase text-slate-950 dark:text-white">
              Autonomous <span className="text-blue-500 not-italic">Sentinel</span>
            </h2>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-slate-200 via-slate-100 to-transparent dark:from-slate-800 dark:via-slate-900 dark:to-transparent" />
            <div className="flex items-center gap-3 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] italic">
              Active_Bots: <span className="text-blue-500">4</span>
            </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-10">
          <Sentinel />
          <NetworkTopology />
        </div>
        <SystemBots />
      </motion.div>

      {/* 🏗️ STRATEGIC INTELLIGENCE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* LEFT COLUMN: Data Synthesis & Relationship Mapping */}
        <div className="lg:col-span-2 space-y-8 lg:space-y-12">
          {/* Relationship Topology Map */}
          <GlassCard className="p-8 lg:p-10 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
              <Users size={300} />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/30">
                    <Users size={24} />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-black tracking-tighter text-slate-950 dark:text-white italic uppercase">
                    Topology <span className="text-blue-500 not-italic">Engine v1.2</span>
                  </h3>
                </div>
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] ml-16 lg:ml-20 italic opacity-80">Autonomous mapping of elite network clusters</p>
              </div>
              <PremiumButton variant="ghost" size="sm" className="rounded-xl hidden sm:flex" rightIcon={<ChevronRight size={16} />}>
                <span className="italic uppercase tracking-widest font-black text-[10px]">Expand Intelligence</span>
              </PremiumButton>
            </div>
            <RelationshipGraph contacts={contacts ?? []} calls={calls ?? []} />
          </GlassCard>

          {/* HIGH-FREQUENCY ENTITIES */}
          <GlassCard className="p-8 lg:p-10">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4 lg:gap-6">
                <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/30">
                  <TrendingUp size={24} />
                </div>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tighter italic uppercase text-slate-950 dark:text-white">
                  High-Priority <span className="text-emerald-500 not-italic">Nodes</span>
                </h2>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/5 hidden sm:flex">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Top_Performers</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
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
                    className="p-6 lg:p-8 flex items-center gap-6 rounded-[2rem] lg:rounded-[2.5rem] transition-all group text-left border border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl hover:bg-white dark:hover:bg-slate-800 shadow-lg hover:shadow-2xl hover:-translate-y-2 relative overflow-hidden active:scale-95 duration-700"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-[1.5rem] overflow-hidden shadow-xl shrink-0 border-[4px] border-white dark:border-slate-700 transform group-hover:scale-110 transition-transform duration-700 relative z-10">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-black text-2xl lg:text-3xl">
                          {contact.first_name[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <h4 className="font-black text-slate-950 dark:text-white truncate group-hover:text-blue-500 transition-colors text-xl lg:text-2xl tracking-tight uppercase italic leading-tight">
                        {contact.first_name} <br /> {contact.last_name}
                      </h4>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="h-[2px] w-8 bg-blue-500/30 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            className="h-full bg-blue-500 shadow-glow" 
                          />
                        </div>
                        <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic flex items-center gap-2">
                          {contact.total_calls} Signals
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </GlassCard>

          {/* SYSTEM THROUGHPUT CHART */}
          <GlassCard className="p-8 lg:p-10 overflow-hidden relative">
            <div className="absolute -top-10 -right-10 p-6 opacity-[0.02] rotate-45 pointer-events-none">
                <PhoneCall size={300} className="text-emerald-500" />
            </div>
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-12 relative z-10 gap-6">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/30">
                    <PhoneCall size={24} />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-black tracking-tighter text-slate-950 dark:text-white italic uppercase">
                    Signal <span className="text-emerald-500 not-italic">Throughput</span>
                  </h3>
                </div>
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] ml-16 italic opacity-80">Interaction density — 14 day cycle</p>
              </div>
              <div className="text-right ml-16 xl:ml-0 bg-slate-950 dark:bg-white px-6 py-3 rounded-[1.5rem] border border-white/10 dark:border-slate-200 shadow-xl">
                <span className="text-5xl lg:text-6xl font-black text-emerald-500 leading-none tracking-tighter italic">
                  {callFrequencyData.reduce((s, d) => s + d.calls, 0)}
                </span>
                <span className="block text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mt-2 italic">Total_Logs</span>
              </div>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={callFrequencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                    <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="8 8" stroke="rgba(148,163,184,0.15)" vertical={false} />
                    <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                    dy={20}
                    />
                    <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }}
                    tickLine={false}
                    axisLine={false}
                    />
                    <Tooltip
                    contentStyle={{
                        backgroundColor: 'rgba(2,6,23,0.95)',
                        backdropFilter: 'blur(30px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '32px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontWeight: '900',
                        boxShadow: '0 40px 100px -20px rgba(0,0,0,0.8)',
                        padding: '24px'
                    }}
                    itemStyle={{ color: '#10b981' }}
                    cursor={{ stroke: '#10b981', strokeWidth: 3, strokeDasharray: '10 10' }}
                    />
                    <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="#10b981"
                    strokeWidth={8}
                    fill="url(#callGrad)"
                    dot={false}
                    activeDot={{ r: 12, fill: '#10b981', stroke: '#fff', strokeWidth: 5 }}
                    animationDuration={3000}
                    />
                </AreaChart>
                </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* RECENT RECORDS */}
          <CallLog />
        </div>

        {/* RIGHT COLUMN: Tactical AI & Proactive Execution */}
        <div className="space-y-8 lg:space-y-12">
          {/* STRATEGIC NUDGES (AI SHELF) */}
          <div className={cn(
            "rounded-[2.5rem] lg:rounded-[3rem] p-8 lg:p-10 backdrop-blur-[60px] shadow-2xl relative overflow-hidden group border-[2px]",
            "bg-slate-950 dark:bg-black border-slate-800/80"
          )}>
            {/* Pulsing engine core */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-600/15 blur-[80px] rounded-full group-hover:bg-blue-600/25 transition-all duration-1000 animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-purple-600/10 blur-[80px] rounded-full opacity-60" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-3xl lg:text-4xl font-black text-white tracking-tighter flex items-center gap-4 italic uppercase">
                    <Sparkles className="text-amber-400" size={28} />
                    Strategic <span className="text-blue-500 not-italic">Nudges</span>
                  </h3>
                  <p className="text-slate-500 font-black text-[9px] uppercase tracking-[0.3em] mt-2 italic opacity-70 ml-12">Engine: Gemini_Ultra_v4</p>
                </div>
                <BrainCircuit className="text-blue-500/30 group-hover:text-blue-400 transition-all group-hover:rotate-[45deg] duration-1000 hidden sm:block" size={48} />
              </div>
              <NudgeShelf nudges={nudges ?? []} />
            </div>
          </div>

          {/* INNER CIRCLE (ELITE NETWORK) */}
          <GlassCard className="p-8 lg:p-10">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-amber-600 text-white shadow-xl shadow-amber-600/40">
                  <Sparkles size={20} />
                </div>
                <h2 className="text-3xl lg:text-4xl font-black italic uppercase tracking-tighter text-slate-950 dark:text-white">
                  Inner <span className="text-amber-500 not-italic">Circle</span>
                </h2>
              </div>
              <div className="h-[2px] w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="space-y-4">
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
                    className="w-full p-4 lg:p-6 flex items-center gap-6 hover:bg-white dark:hover:bg-slate-900 rounded-[2rem] transition-all group text-left border border-transparent hover:border-slate-200 dark:hover:border-white/5 shadow-sm hover:shadow-xl relative overflow-hidden active:scale-95 duration-500"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden shadow-lg shrink-0 border-[3px] border-white dark:border-slate-800 transform group-hover:scale-110 transition-transform duration-700 relative z-10">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-xl lg:text-2xl">
                          {contact.first_name[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <h4 className="font-black text-slate-950 dark:text-white truncate group-hover:text-amber-600 transition-colors text-lg lg:text-xl tracking-tighter uppercase italic">
                        {contact.first_name} {contact.last_name}
                      </h4>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="h-[3px] w-10 bg-amber-500/20 rounded-full overflow-hidden">
                            <motion.div 
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="h-full bg-amber-500 w-full" 
                            />
                        </div>
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] italic">Elite_Node</span>
                      </div>
                    </div>
                  </button>
                ))}
              {(contacts || []).filter(c => c.is_favorite).length === 0 && (
                <div className="text-center py-12 px-8 rounded-[2.5rem] bg-slate-50/50 dark:bg-slate-900/30 border-[2px] border-dashed border-slate-200 dark:border-slate-800 transition-all hover:border-blue-500/30 duration-700">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Users className="text-slate-300 dark:text-slate-600" size={32} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-black italic uppercase tracking-[0.3em] leading-relaxed">
                    Vault Isolated. <br /> Initialize inner circle <br /> to enable monitoring.
                  </p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* NETWORK STABILITY INDEX */}
          <GlassCard className="p-8 lg:p-10 overflow-hidden relative">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-glow-emerald" />
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/40">
                  <TrendingUp size={20} />
                </div>
                <h3 className="text-3xl lg:text-4xl font-black italic uppercase tracking-tighter text-slate-950 dark:text-white">
                  Network <span className="text-emerald-500 not-italic">Resonance</span>
                </h3>
              </div>
            </div>
            <div className="space-y-12 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <span className="block text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.3em] text-[9px] italic">Operational Equilibrium</span>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-glow-emerald" />
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em] italic">Stability_Verified</span>
                    </div>
                </div>
                <span className="text-6xl lg:text-7xl font-black text-emerald-500 tracking-[-0.05em] italic leading-none">{stats?.avgHealth || 0}%</span>
              </div>
              <div className="relative pt-2">
                <div className="overflow-hidden h-8 mb-4 text-xs flex rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-inner p-1">
                    <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stats?.avgHealth || 0}%` }}
                    transition={{ duration: 3, ease: [0.22, 1, 0.36, 1] }}
                    className="shadow-xl flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 relative rounded-full overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    </motion.div>
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 italic px-2">
                    <span>Critical</span>
                    <span className="text-emerald-500">Optimal</span>
                    <span>Zenith</span>
                </div>
              </div>
              <div className="p-6 lg:p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900/80 border border-slate-200/50 dark:border-white/5 relative overflow-hidden group/quote shadow-lg">
                <div className="absolute top-0 left-0 w-[3px] h-full bg-emerald-500 group-hover:w-full transition-all duration-1000 opacity-20" />
                <p className="text-sm lg:text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed font-black italic relative z-10">
                  "Network resonance is verified at <span className="text-emerald-500">{stats?.avgHealth || 0}%</span>. Maintenance of elite connectivity levels is highly recommended for strategic dominance."
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view) => console.log('Navigate to', view)}
        calls={calls ?? []}
        contacts={contacts ?? []}
      />

      <AnimatePresence>
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
      </AnimatePresence>
    </motion.div>
  );
};

export default Dashboard;
