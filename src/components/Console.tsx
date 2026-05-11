import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Terminal, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Trash2, 
  Maximize2, 
  Minimize2,
  Cpu,
  Layers
} from 'lucide-react';
import { cn } from '@/utils/ui';
import Sentinel from './Sentinel';
import SystemBots from './SystemBots';
import GlassCard from './common/GlassCard';

export interface LogEntry {
    timestamp: string;
    type: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARNING' | 'NATIVE';
    message: string;
    details?: any;
}

interface ConsoleProps {
    logs?: LogEntry[];
    onClear?: () => void;
    isRunning?: boolean;
}

const Console: React.FC<ConsoleProps> = ({ logs: initialLogs = [], onClear = () => {} }) => {
    const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
    const [isFullLog, setIsFullLog] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Internal log simulation if none provided
    useEffect(() => {
        if (initialLogs.length > 0) {
            setLogs(initialLogs);
        } else {
            // Mock initialization logs for premium feel
            const bootLogs: LogEntry[] = [
                { timestamp: new Date().toISOString(), type: 'INFO', message: 'Initializing Horizon_OS Kernel...' },
                { timestamp: new Date().toISOString(), type: 'SUCCESS', message: 'Neural Bridge established.' },
                { timestamp: new Date().toISOString(), type: 'INFO', message: 'Connecting to Supabase Matrix...' },
                { timestamp: new Date().toISOString(), type: 'SUCCESS', message: 'Database uplink stable.' },
            ];
            setLogs(bootLogs);
        }
    }, [initialLogs]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'ERROR': return <AlertCircle size={14} className="text-red-400" />;
            case 'SUCCESS': return <CheckCircle2 size={14} className="text-emerald-400" />;
            case 'WARNING': return <AlertCircle size={14} className="text-amber-400" />;
            case 'NATIVE': return <Activity size={14} className="text-blue-400" />;
            default: return <Info size={14} className="text-slate-500" />;
        }
    };

    const getBadgeStyle = (type: string) => {
        switch (type) {
            case 'ERROR': return 'text-red-500 border-red-500/30 bg-red-500/10 shadow-glow-red';
            case 'SUCCESS': return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10 shadow-glow-emerald';
            case 'WARNING': return 'text-amber-500 border-amber-500/30 bg-amber-500/10 shadow-glow-warn';
            case 'NATIVE': return 'text-blue-500 border-blue-500/30 bg-blue-500/10 shadow-glow-blue';
            default: return 'text-slate-400 border-slate-700 bg-slate-800/20';
        }
    };

    return (
        <div className="space-y-10 animate-reveal">
            {/* Mission Control Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-600/20 shadow-inner">
                            <Layers size={24} className="text-blue-500" />
                        </div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-500/80 italic">SYSTEM_ORCHESTRATOR_v2.0</h2>
                    </div>
                    <h1 className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic leading-none">
                        Mission<span className="text-blue-600">.</span>Control
                    </h1>
                </div>
                <div className="flex gap-4">
                    <div className="px-8 py-4 glass-effect rounded-[2rem] border-white/10 shadow-premium flex items-center gap-6 group hover:border-blue-500/30 transition-all duration-500">
                        <div className="relative">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-glow-emerald" />
                            <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500/50 animate-ping" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none">CORE_STATUS</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white italic mt-1.5 uppercase tracking-tighter">OPERATIONAL_UPLINK</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Level Monitoring: Sentinel */}
            <div className="relative">
                <div className="absolute -inset-4 bg-blue-500/5 blur-3xl rounded-full opacity-50 -z-10" />
                <Sentinel />
            </div>

            {/* Middle Section: System Bots & Agents */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-px bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-700" />
                        <Bot size={18} className="text-slate-500" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Autonomous_Agent_Swarm</h3>
                        <div className="w-24 h-px bg-gradient-to-r from-slate-300 dark:from-slate-700 to-transparent" />
                    </div>
                </div>
                <SystemBots />
            </div>

            {/* Bottom Section: Integrated Console */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-px bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-700" />
                        <Terminal size={18} className="text-slate-500" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Global_System_Logs</h3>
                        <div className="w-24 h-px bg-gradient-to-r from-slate-300 dark:from-slate-700 to-transparent" />
                    </div>
                </div>
                
                <GlassCard className={cn(
                    "p-0 border-white/5 shadow-2xl-premium overflow-hidden glass-premium transition-all duration-700 relative",
                    isFullLog ? "fixed inset-8 z-[100] h-auto rounded-[3rem]" : "h-[600px]"
                )}>
                    <div className="absolute inset-0 scanline opacity-20 pointer-events-none z-10" />
                    <div className="absolute inset-0 bg-slate-950/40 -z-10" />
                    
                    {/* Console Header */}
                    <div className="flex items-center justify-between px-8 py-6 bg-white/5 border-b border-white/10 backdrop-blur-2xl sticky top-0 z-30">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-glow-blue" />
                                <span className="text-[11px] font-black text-white uppercase tracking-[0.3em] italic">LIVE_UPLINK_STREAM</span>
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-2" />
                            <div className="flex items-center gap-3">
                                <Cpu size={14} className="text-slate-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Node: HORIZON_ALPHA_01</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={onClear}
                                className="p-3 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20 group"
                                title="Purge Cache"
                            >
                                <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <button 
                                onClick={() => setIsFullLog(!isFullLog)}
                                className="p-3 rounded-xl hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-all border border-transparent hover:border-blue-500/20 group"
                                title={isFullLog ? "Exit Focus" : "Enter Focus"}
                            >
                                {isFullLog ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Console Output */}
                    <div className="p-8 h-full overflow-y-auto luxury-scroll font-mono text-[12px] space-y-2 bg-slate-950 relative pb-32">
                        <div className="absolute inset-0 bg-carbon opacity-[0.02] pointer-events-none" />
                        
                        {logs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-8 py-20">
                                <div className="relative">
                                    <Terminal size={64} className="opacity-10 animate-pulse" />
                                    <motion.div 
                                        className="absolute inset-0 border-2 border-blue-500/20 rounded-full"
                                        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                                        transition={{ duration: 2, repeat: Infinity } as const}
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-[11px] font-black uppercase tracking-[0.6em] italic text-slate-600">Awaiting_System_Stream...</p>
                                    <p className="text-[9px] font-bold text-slate-800 uppercase tracking-widest mt-3">Connection status: LISTENING</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {logs.map((log, index) => (
                                    <motion.div 
                                        key={index} 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex gap-6 group items-start py-2 px-4 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
                                    >
                                        <span className="text-slate-600 shrink-0 font-bold mt-1 text-[10px] opacity-60">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                        <div className={cn(
                                            "shrink-0 px-2.5 py-0.5 rounded-lg text-[9px] font-black tracking-[0.15em] border mt-0.5 transition-all group-hover:scale-105",
                                            getBadgeStyle(log.type)
                                        )}>
                                            {log.type}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                "font-bold tracking-tight leading-relaxed text-sm",
                                                log.type === 'ERROR' ? "text-red-400" : 
                                                log.type === 'SUCCESS' ? "text-emerald-400" :
                                                log.type === 'WARNING' ? "text-amber-400" :
                                                log.type === 'NATIVE' ? "text-blue-400" :
                                                "text-slate-300 group-hover:text-white"
                                            )}>
                                                {log.message}
                                            </p>
                                            {log.details && (
                                                <motion.div 
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="mt-4"
                                                >
                                                    <pre className="text-[10px] bg-black/60 p-6 rounded-[1.5rem] border border-white/5 overflow-x-auto text-blue-400/70 font-mono luxury-scroll shadow-inner">
                                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                </motion.div>
                                            )}
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-all mt-1 duration-300 transform group-hover:translate-x-1">
                                            {getIcon(log.type)}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                        <div ref={endRef} className="h-8" />
                    </div>
                </GlassCard>
            </div>
            
            {/* Fullscreen Overlay Close Button */}
            {isFullLog && (
                <button 
                    onClick={() => setIsFullLog(false)}
                    className="fixed top-12 right-12 z-[110] p-5 bg-white/10 hover:bg-red-500 text-white rounded-full shadow-2xl backdrop-blur-xl border border-white/10 hover:border-red-500 transition-all hover:scale-110 active:scale-95 group"
                >
                    <X size={28} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
            )}
        </div>
    );
};

// Internal sub-components for the console page
const Bot = ({ size, className }: { size: number, className?: string }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
    </svg>
);

const X = ({ size, className }: { size: number, className?: string }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

export default Console;
