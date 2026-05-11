import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Search, 
  Wrench, 
  Shield, 
  Zap, 
  Activity,
  Cpu,
  Terminal,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  X,
  Server,
  HardDrive,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GlassCard from './common/GlassCard';
import PremiumButton from './common/PremiumButton';
import { useSystemGuardian } from '@/hooks/useSystemGuardian';
import { useGuardianStore } from '@/store/guardianStore';
import { connectionLogger, LogEntry } from '@/utils/connectionLogger';

const SystemBots: React.FC = () => {
  const { status } = useSystemGuardian();
  const { agents, reports } = useGuardianStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Sync with real connection logs
  useEffect(() => {
    return connectionLogger.subscribe((allLogs) => {
      setLogs(allLogs.slice(0, 15));
    });
  }, []);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'guardian': return <Shield size={16} className="text-blue-400" />;
      case 'scout': return <Search size={16} className="text-emerald-400" />;
      case 'fixer': return <Wrench size={16} className="text-amber-400" />;
      case 'analyst': return <Zap size={16} className="text-purple-400" />;
      default: return <Bot size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      case 'scanning': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'repairing': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'optimizing': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'warning': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-10 p-1">
      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {agents.map((agent) => (
          <GlassCard key={agent.id} className="p-8 border-white/5 shadow-premium relative overflow-hidden group hover:border-blue-500/30 transition-all duration-700 glass-premium">
            <div className="absolute inset-0 bg-carbon opacity-[0.05] -z-10" />
            
            {agent.status !== 'idle' && (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent -z-10"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            )}
            
            <div className="flex justify-between items-start mb-10">
              <div className="flex items-center gap-5">
                <div className={cn(
                  "p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all duration-500 shadow-inner",
                  agent.status !== 'idle' && "border-blue-500/40 shadow-glow"
                )}>
                  <Bot size={28} className={agent.status !== 'idle' ? "text-blue-500 animate-pulse" : "text-slate-500"} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white tracking-tighter uppercase italic text-lg leading-none text-glow">{agent.name}</h4>
                  <div className="flex items-center gap-2.5 mt-2">
                    {getRoleIcon(agent.role)}
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 italic">{agent.role}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2.5">
                <div className={cn("text-[10px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-xl border shadow-sm", getStatusColor(agent.status))}>
                  {agent.status}
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic opacity-60">OPS: {agent.missionCount}</span>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-[0.2em] italic">
                <div className="flex items-center gap-3 text-slate-500">
                  <Target size={14} className="text-blue-500/50" />
                  <span className="truncate max-w-[160px]">
                    {agent.lastAction ? agent.lastAction : 'IDLE_WAIT'}
                  </span>
                </div>
                <span className="text-slate-900 dark:text-white font-mono text-glow">{Math.floor(agent.progress)}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
                <motion.div 
                   initial={false}
                  animate={{ width: `${agent.progress}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    agent.status === 'scanning' && "bg-emerald-500 shadow-glow-emerald",
                    agent.status === 'repairing' && "bg-amber-500 shadow-glow-amber",
                    agent.status === 'optimizing' && "bg-purple-500 shadow-glow-purple",
                    agent.status === 'warning' && "bg-red-500 shadow-glow-red",
                    agent.status === 'idle' && "bg-slate-500"
                  )}
                />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Main Command Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Telemetry Stream */}
        <GlassCard className="lg:col-span-2 p-0 border-white/5 shadow-premium overflow-hidden glass-premium bg-slate-950/40 relative group">
          <div className="absolute inset-0 scanline opacity-30 pointer-events-none" />
          <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-6">
              <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-inner">
                <Terminal size={22} className="text-blue-400" />
              </div>
              <div>
                <h4 className="text-[13px] font-black text-white uppercase tracking-[0.4em] italic leading-none text-glow">Global_Agent_Telemetry.exe</h4>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 opacity-60">Real-time Autonomous Interaction Log</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-glow-emerald" />
                <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest italic leading-none">Uplink_Live</span>
              </div>
              <PremiumButton 
                variant="secondary" 
                size="sm"
                className="text-[10px] py-2 px-6 shadow-sm"
                onClick={() => setIsReportOpen(true)}
              >
                VIEW_ARCHIVE
              </PremiumButton>
            </div>
          </div>
          <div className="p-8 h-96 overflow-y-auto thin-scrollbar font-mono text-[12px] space-y-3 bg-carbon relative">
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-5 group items-center py-1"
                >
                  <span className="text-slate-600 shrink-0 font-bold opacity-50">[{log.timestamp}]</span>
                  <span className={cn(
                    "font-black shrink-0 tracking-widest uppercase text-[10px] px-2 py-0.5 rounded border border-white/5 bg-white/5",
                    log.method === 'GUARDIAN' ? "text-blue-500" : "text-purple-500"
                  )}>{log.method}</span>
                  <div className="h-px w-8 bg-white/10" />
                  <span className={cn(
                    "shrink-0 font-bold tracking-tight text-lg",
                    log.type === 'success' ? "text-emerald-400" : 
                    log.type === 'error' ? "text-red-400" : "text-slate-400"
                  )}>
                    {log.message}
                  </span>
                  <div className="h-px flex-1 bg-white/5 group-hover:bg-white/10 transition-colors" />
                  <ChevronRight size={14} className="text-slate-800 group-hover:text-blue-500 transition-colors" />
                </motion.div>
              ))}
            </AnimatePresence>
            {logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-8 text-slate-700">
                <Cpu size={40} className="animate-spin duration-[10000ms] opacity-20" />
                <span className="italic font-black tracking-[0.6em] uppercase text-[11px] opacity-40">Synchronizing_Neural_Core...</span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* System Health Status */}
        <GlassCard className="p-10 border-white/5 shadow-premium flex flex-col justify-between relative overflow-hidden glass-premium group">
          <div className="absolute inset-0 bg-carbon opacity-[0.03] -z-10" />
          <div className="space-y-10">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em] italic flex items-center gap-4">
                <Activity size={20} className="text-blue-500" />
                System_Vitals
              </h4>
              <div className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] italic shadow-glow">
                OPTIMAL
              </div>
            </div>
            
            <div className="space-y-8">
              {[
                { label: 'Supabase_Matrix', val: status.supabase.toUpperCase(), color: status.supabase === 'online' ? 'text-emerald-500' : 'text-red-500', icon: Server },
                { label: 'Neural_Uplink', val: status.network.toUpperCase(), color: status.network === 'online' ? 'text-blue-500' : 'text-red-500', icon: Activity },
                { label: 'Signal_Latency', val: `${status.latency}MS`, color: status.latency < 200 ? 'text-emerald-500' : 'text-amber-500', icon: Zap },
                { label: 'Core_Storage', val: `${status.storageUsage}%`, color: status.storageUsage < 70 ? 'text-slate-500' : 'text-amber-500', icon: HardDrive },
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-end border-b border-white/5 pb-6 group/stat transition-all">
                  <div className="flex items-center gap-4">
                    <stat.icon size={20} className="text-slate-600 group-hover/stat:text-blue-400 transition-all group-hover/stat:scale-110" />
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none opacity-60 group-hover/stat:opacity-100 transition-opacity">{stat.label}</span>
                  </div>
                  <span className={cn("text-2xl font-black tracking-tighter italic leading-none text-glow", stat.color)}>{stat.val}</span>
                </div>
              ))}
            </div>
          </div>
          
          <button 
            className="mt-16 py-5 w-full glass-effect bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.4em] italic text-slate-500 hover:text-white transition-all shadow-premium group/btn overflow-hidden relative"
            onClick={() => setIsReportOpen(true)}
          >
            <div className="absolute inset-0 bg-blue-500/5 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
            <span className="relative z-10 flex items-center justify-center gap-3">
              <ClipboardList size={18} />
              OPEN_INTELLIGENCE_ARCHIVE
            </span>
          </button>
        </GlassCard>
      </div>

      {/* Reports Modal Overlay */}
      <AnimatePresence>
        {isReportOpen && (
          <motion.div 
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsReportOpen(false)}
            className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[100]"
          />
        )}
        {isReportOpen && (
          <motion.div 
            key="modal"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[900px] md:h-[85vh] bg-slate-950 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 z-[101] flex flex-col overflow-hidden glass-premium"
          >
              <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/5 relative">
                <div className="absolute inset-0 scanline opacity-20 pointer-events-none" />
                <div className="flex items-center gap-6 relative z-10">
                  <div className="p-4 rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-600/20 shadow-glow">
                    <ClipboardList size={32} />
                  </div>
                  <div>
                    <h3 className="text-4xl font-black text-white tracking-tighter uppercase italic text-glow">Intelligence Archive</h3>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] italic mt-1">Historical_Mission_Execution_Parameters</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="p-3.5 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-all border border-transparent hover:border-white/10 relative z-10"
                >
                  <X size={28} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 space-y-6 thin-scrollbar bg-carbon relative">
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                {reports.map((report, idx) => (
                  <motion.div 
                    key={report.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-8 rounded-[2.5rem] bg-white/5 border border-white/5 group hover:border-blue-500/40 transition-all relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center border border-white/10 shadow-inner group-hover:border-blue-500/50 transition-all group-hover:scale-105">
                          <Bot size={28} className="text-blue-500" />
                        </div>
                        <div>
                          <h4 className="font-black text-white text-lg uppercase italic tracking-tighter leading-none">{report.agentName}</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic mt-1.5">{report.action}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-lg transition-all",
                        report.result === 'fixed' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5",
                        report.result === 'optimized' && "bg-purple-500/10 text-purple-400 border-purple-400/20 shadow-purple-500/5",
                        report.result === 'verified' && "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5",
                      )}>
                        {report.result === 'fixed' && <Wrench size={12} />}
                        {report.result === 'optimized' && <Zap size={12} />}
                        {report.result === 'verified' && <CheckCircle2 size={12} />}
                        {report.result}
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed font-bold font-mono tracking-tight relative z-10 bg-black/20 p-4 rounded-xl border border-white/5">{report.details}</p>
                    <div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-center text-[10px] font-black text-slate-600 uppercase tracking-widest italic relative z-10">
                      <span className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-slate-700" />
                        REF_CORE_ID: {report.id}
                      </span>
                      <span className="text-slate-500">{new Date(report.timestamp).toLocaleTimeString()} | {new Date(report.timestamp).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                ))}
                {reports.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-32 text-center space-y-8">
                    <div className="w-32 h-32 rounded-full bg-white/5 flex items-center justify-center border border-dashed border-white/10 relative">
                      <div className="absolute inset-0 rounded-full border-2 border-blue-500/10 animate-ping duration-[3000ms]" />
                      <AlertCircle size={48} className="text-slate-800" />
                    </div>
                    <div>
                      <p className="text-slate-500 font-black uppercase tracking-[0.5em] italic text-sm">Archive_Empty</p>
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-2">Awaiting system events for neural cataloging</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SystemBots;
