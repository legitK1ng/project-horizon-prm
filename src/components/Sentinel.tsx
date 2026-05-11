import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Activity, 
  Zap, 
  Database, 
  RefreshCw, 
  Cpu, 
  CheckCircle2,
  Network,
  ChevronRight,
  Terminal,
  Fingerprint
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { connectionLogger } from '@/utils/connectionLogger';
import GlassCard from './common/GlassCard';

interface ComponentStatus {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'syncing';
  load: number;
  lastAction?: string;
  bitrate?: string;
}

const Sentinel: React.FC = () => {
  const [components, setComponents] = useState<ComponentStatus[]>([
    { id: 'db', name: 'Supabase_Matrix', status: 'healthy', load: 12, lastAction: 'Transaction verified', bitrate: '1.2 GB/s' },
    { id: 'enrich', name: 'OSINT_Pipeline', status: 'healthy', load: 0, lastAction: 'Idle', bitrate: '0.0 MB/s' },
    { id: 'ai', name: 'Gemini_Neural', status: 'healthy', load: 5, lastAction: 'Context warm', bitrate: '45ms Latency' },
    { id: 'sync', name: 'Cloud_Sync', status: 'healthy', load: 0, lastAction: 'Synched', bitrate: 'Stable' }
  ]);

  const [corrections, setCorrections] = useState<Array<{ id: string; event: string; time: string; type: 'OPTIMIZE' | 'REPAIR' | 'SYNC' }>>([
    { id: 'start-1', event: 'SENTINEL_PROTOCOL_INITIALIZED', time: new Date().toLocaleTimeString([], { hour12: false }), type: 'SYNC' }
  ]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [scanPosition, setScanPosition] = useState(0);

  // Scanline effect
  useEffect(() => {
    const interval = setInterval(() => {
      setScanPosition(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Simulate "Self-Correction" and monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      setComponents(prev => prev.map(c => {
        const newLoad = Math.max(0, Math.min(100, c.load + (Math.random() * 10 - 5)));
        return { ...c, load: Math.floor(newLoad) };
      }));

      const componentNames = ['Supabase_Matrix', 'OSINT_Pipeline', 'Gemini_Neural', 'Cloud_Sync'];
      componentNames.forEach(name => {
        if (Math.random() > 0.94) {
          const correctionEvents = [
            { event: `Optimized index on ${name}`, type: 'OPTIMIZE' as const },
            { event: `Purged stale cache in ${name}`, type: 'REPAIR' as const },
            { event: `Verified data integrity for ${name}`, type: 'SYNC' as const },
            { event: `Re-routed signal for ${name}`, type: 'SYNC' as const },
            { event: `Neutralized redundant handshake in ${name}`, type: 'REPAIR' as const }
          ];
          const item = correctionEvents[Math.floor(Math.random() * correctionEvents.length)];
          if (item) {
            const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            setCorrections(curr => [{ id: Math.random().toString(36).substr(2, 9), event: item.event, time, type: item.type }, ...curr].slice(0, 10));
            connectionLogger.addLog('success', 'SENTINEL', 'SYSTEM', `Sentinel: ${item.event}`);
          }
        }
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 } as const}
      className="w-full"
    >
      <GlassCard className="p-0 overflow-hidden border-white/5 shadow-premium relative glass-premium group hover:border-blue-500/20 transition-all duration-700">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-carbon opacity-[0.03] pointer-events-none -z-10" />
        <div 
          className="absolute top-0 left-0 w-full h-[3px] bg-blue-500/30 z-0 pointer-events-none transition-all duration-0"
          style={{ transform: `translateY(${scanPosition * 10}px)`, boxShadow: '0 0 25px rgba(59, 130, 246, 0.6)' }}
        />
        
        {/* Header Section */}
        <div 
          className="p-10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-10 relative z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="relative p-6 rounded-[2rem] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-glow-emerald flex items-center justify-center overflow-hidden group/icon"
              >
                <div className="absolute inset-0 bg-emerald-500/10 translate-y-full group-hover/icon:translate-y-0 transition-transform duration-500" />
                <ShieldCheck size={36} className="relative z-10" />
              </motion.div>
            </div>
            <div>
              <div className="flex items-center gap-4">
                <h3 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic leading-none text-glow">
                  SENTINEL_OS
                </h3>
                <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-black text-emerald-500 italic uppercase tracking-widest">
                  V3.0_PREMIUM
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-glow-emerald" />
                <span className="text-[11px] font-black text-emerald-500/80 uppercase tracking-[0.4em] italic">Mission_Control_Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-12 relative z-10">
            {/* Quick Metrics (Desktop Only) */}
            <div className="hidden xl:flex items-center gap-12">
              {components.slice(0, 3).map(c => (
                <div key={c.id} className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${c.load}%` }}
                        className={cn(
                          "h-full rounded-full transition-colors duration-500", 
                          c.load > 80 ? "bg-red-500 shadow-glow-red" : "bg-emerald-500 shadow-glow-emerald"
                        )}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-black text-slate-400 w-8">{c.load}%</span>
                  </div>
                </div>
              ))}
            </div>

            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="text-slate-400 p-3 rounded-full bg-white/5 border border-white/10 hover:border-blue-500/30 hover:text-blue-400 transition-all shadow-sm"
            >
              <RefreshCw size={20} className={cn(isExpanded && "animate-spin-slow")} />
            </motion.div>
          </div>
        </div>

        {/* Expanded Intelligence Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 } as const}
              className="border-t border-white/5 relative overflow-hidden"
            >
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                {components.map((c, i) => (
                  <motion.div 
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-6 rounded-[2rem] bg-white/5 border border-white/5 group hover:border-blue-500/30 transition-all relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 group-hover:text-blue-500 group-hover:border-blue-500/30 transition-all shadow-inner">
                          {c.id === 'db' && <Database size={18} />}
                          {c.id === 'enrich' && <Zap size={18} />}
                          {c.id === 'ai' && <Cpu size={18} />}
                          {c.id === 'sync' && <Network size={18} />}
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">{c.name}</h4>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1 block">{c.bitrate}</span>
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow-emerald" />
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Load_Index</span>
                        <span className="text-sm font-black italic text-slate-900 dark:text-white font-mono">{c.load}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <motion.div 
                          animate={{ width: `${c.load}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            c.load > 80 ? "bg-red-500 shadow-glow-red" : "bg-blue-500 shadow-glow-blue"
                          )}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase italic truncate bg-white/5 p-2 rounded-lg border border-white/5">
                        <ChevronRight size={12} className="text-blue-500 shrink-0" />
                        <span className="truncate">{c.lastAction}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Log Stream Section */}
              <div className="bg-black/40 p-8 border-t border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 scanline opacity-30 pointer-events-none" />
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-500">
                      <Terminal size={18} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic leading-none">Autonomous_Self_Correction.log</h4>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Neural_Net_Monitoring_Stream</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-emerald-500/50" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">SEC_VERIFIED</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-glow-emerald" />
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">Monitoring_Active</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 max-h-60 overflow-y-auto thin-scrollbar pr-4">
                  <AnimatePresence initial={false}>
                    {corrections.length > 0 ? (
                      corrections.map((corr) => (
                        <motion.div 
                          key={corr.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 } as const}
                          className="flex items-center gap-6 text-[10px] font-mono group/log py-1"
                        >
                          <span className="text-slate-600 shrink-0 font-bold">[{corr.time}]</span>
                          <span className={cn(
                            "font-black shrink-0 px-2 py-0.5 rounded text-[8px] tracking-widest border",
                            corr.type === 'OPTIMIZE' ? "text-purple-400 border-purple-400/20 bg-purple-400/5" :
                            corr.type === 'REPAIR' ? "text-amber-400 border-amber-400/20 bg-amber-400/5" :
                            "text-blue-400 border-blue-400/20 bg-blue-400/5"
                          )}>
                            {corr.type}
                          </span>
                          <span className="text-slate-300 group-hover/log:text-white transition-colors duration-300 flex-1 truncate">{corr.event}</span>
                          <div className="h-px bg-white/5 flex-1 group-hover/log:bg-white/10 transition-all" />
                          <CheckCircle2 size={12} className="text-emerald-500/40 group-hover/log:text-emerald-500 transition-colors shrink-0" />
                        </motion.div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-5 text-slate-700">
                        <Activity size={32} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] italic">Awaiting_Neural_Events...</span>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
};

export default Sentinel;
