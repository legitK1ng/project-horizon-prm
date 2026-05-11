import React from 'react';
import { motion } from 'framer-motion';
import { 
  Cloud, 
  Smartphone, 
  BrainCircuit, 
  Database,
  ArrowRight,
  Zap,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GlassCard from './common/GlassCard';

const NetworkTopology: React.FC = () => {
  const nodes = [
    { id: 'mobile', label: 'ACR Mobile', icon: Smartphone, color: 'emerald', status: 'connected' },
    { id: 'cloud', label: 'Supabase Matrix', icon: Database, color: 'blue', status: 'synced' },
    { id: 'ai', label: 'Gemini Neural', icon: BrainCircuit, color: 'purple', status: 'ready' },
    { id: 'ui', label: 'Horizon UI', icon: Cloud, color: 'amber', status: 'active' },
  ];

  const connections = [
    { from: 'mobile', to: 'cloud', label: 'DATA_UPLINK' },
    { from: 'cloud', to: 'ai', label: 'VECTOR_STREAM' },
    { from: 'ai', to: 'cloud', label: 'NEURAL_INSIGHTS' },
    { from: 'cloud', to: 'ui', label: 'REALTIME_SYNC' },
  ];

  return (
    <GlassCard className="p-8 border-horizon-500/5 shadow-premium overflow-hidden relative glass-premium group hover:border-blue-500/20 transition-all duration-700">
      {/* Background Grid & Carbon */}
      <div className="absolute inset-0 bg-grid opacity-10 -z-10" />
      <div className="absolute inset-0 bg-carbon opacity-[0.03] pointer-events-none -z-10" />
      
      <div className="flex items-center justify-between mb-12 relative z-10">
        <div className="flex items-center gap-6">
          <div className="p-4 rounded-[1.5rem] bg-slate-900 dark:bg-white text-white dark:text-black shadow-glow group-hover:rotate-[360deg] transition-transform duration-[1500ms]">
            <Zap size={28} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic leading-none">
              System_Topology
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-glow" />
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Orchestration_Pipeline_V2.0</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest italic shadow-inner">
            <Activity size={16} className="animate-pulse" />
            Lat: 38ms
          </div>
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest italic shadow-inner">
            <ShieldCheck size={16} />
            Encrypted
          </div>
        </div>
      </div>

      <div className="relative h-[350px] flex items-center justify-between px-16 scanline overflow-hidden rounded-[2rem] bg-black/20 border border-white/5">
        <div className="absolute inset-0 bg-carbon opacity-[0.05] pointer-events-none" />
        
        {/* Connection Lines (Animated) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="rgba(0, 87, 255, 0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <filter id="nodeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Paths between nodes */}
          <motion.path 
            d="M 120 175 L 320 175" 
            stroke="currentColor" 
            strokeWidth="0.5" 
            className="text-white/10"
            strokeDasharray="6 6"
          />
          <motion.path 
            d="M 420 175 L 620 175" 
            stroke="currentColor" 
            strokeWidth="0.5" 
            className="text-white/10"
            strokeDasharray="6 6"
          />
          <motion.path 
            d="M 720 175 L 920 175" 
            stroke="currentColor" 
            strokeWidth="0.5" 
            className="text-white/10"
            strokeDasharray="6 6"
          />

          {/* Animated Particles */}
          <motion.circle
            cx={120}
            r="4"
            fill="#0057FF"
            filter="url(#nodeGlow)"
            initial={{ cx: 120, opacity: 0 }}
            animate={{ cx: [120, 920], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.circle
            cx={120}
            r="3"
            fill="#10b981"
            filter="url(#nodeGlow)"
            initial={{ cx: 120, opacity: 0 }}
            animate={{ cx: [120, 320], opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
          />
          <motion.circle
            cx={320}
            r="3"
            fill="#8b5cf6"
            filter="url(#nodeGlow)"
            initial={{ cx: 320, opacity: 0 }}
            animate={{ cx: [320, 620], opacity: [0, 1, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: 0.5 }}
          />
        </svg>

        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="flex flex-col items-center gap-6 relative z-10 group"
          >
            <div className={cn(
              "w-28 h-28 rounded-[2.5rem] flex items-center justify-center transition-all duration-700 relative",
              "glass-effect bg-white/5 border border-white/10 shadow-premium overflow-hidden",
              node.color === 'emerald' && "group-hover:border-emerald-500/50 group-hover:shadow-glow-emerald",
              node.color === 'blue' && "group-hover:border-blue-500/50 group-hover:shadow-glow-blue",
              node.color === 'purple' && "group-hover:border-purple-500/50 group-hover:shadow-glow-purple",
              node.color === 'amber' && "group-hover:border-amber-500/50 group-hover:shadow-glow-amber",
            )}>
              <div className="absolute inset-0 bg-carbon opacity-0 group-hover:opacity-[0.05] transition-opacity" />
              <node.icon size={40} className={cn(
                "transition-all group-hover:scale-110 group-hover:rotate-6 duration-700",
                node.color === 'emerald' && "text-emerald-500",
                node.color === 'blue' && "text-blue-500",
                node.color === 'purple' && "text-purple-500",
                node.color === 'amber' && "text-amber-500",
              )} />
              
              {/* Internal glow */}
              <div className={cn(
                "absolute -inset-2 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity",
                node.color === 'emerald' && "bg-emerald-500",
                node.color === 'blue' && "bg-blue-500",
                node.color === 'purple' && "bg-purple-500",
                node.color === 'amber' && "bg-amber-500",
              )} />
            </div>
            
            <div className="text-center">
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-900 dark:text-white italic">{node.label}</h4>
              <div className="flex items-center justify-center gap-2 mt-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/5 shadow-inner">
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                  node.status === 'connected' || node.status === 'synced' || node.status === 'ready' || node.status === 'active' 
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-slate-400"
                )} />
                <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500 italic">{node.status}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Connection Info Overlay */}
      <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-8 pt-10 border-t border-white/5 relative z-10">
        {connections.map((conn, i) => (
          <div key={i} className="flex flex-col gap-2 group">
            <div className="flex items-center gap-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
              <span>{conn.from}</span>
              <ArrowRight size={10} className="text-blue-500" />
              <span>{conn.to}</span>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase italic">{conn.label}</p>
              <span className="text-[8px] font-mono text-emerald-500">ACTIVE</span>
            </div>
            <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full mt-2 overflow-hidden border border-white/5 shadow-inner">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: Math.random() * 2 }}
              />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default NetworkTopology;

