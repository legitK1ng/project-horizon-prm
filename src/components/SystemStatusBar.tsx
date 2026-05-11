import React from 'react';
import { useSystemGuardian } from '../hooks/useSystemGuardian';
import { Activity, Database, Wifi, Cpu, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

const SystemStatusBar: React.FC = () => {
  const { status } = useSystemGuardian();

  const metrics = [
    {
      label: 'NETWORK',
      value: status.network === 'online' ? 'SECURE' : 'OFFLINE',
      icon: Wifi,
      color: status.network === 'online' ? 'text-emerald-500' : 'text-rose-500',
    },
    {
      label: 'SUPABASE',
      value: status.supabase.toUpperCase(),
      icon: Database,
      color: status.supabase === 'online' ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      label: 'LATENCY',
      value: `${status.latency}MS`,
      icon: Activity,
      color: status.latency < 100 ? 'text-emerald-500' : status.latency < 300 ? 'text-amber-500' : 'text-rose-500',
    },
    {
      label: 'CACHE',
      value: `${status.storageUsage}%`,
      icon: Cpu,
      color: status.storageUsage < 70 ? 'text-emerald-500' : 'text-amber-500',
    }
  ];

  return (
    <div className="w-full bg-slate-950/90 backdrop-blur-md border-b border-white/5 pt-safe px-4 py-1.5 flex items-center justify-between overflow-hidden relative group">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar relative z-10">
        <div className="flex items-center gap-2 border-r border-white/10 pr-4 shrink-0">
          <ShieldCheck size={14} className="text-blue-500" />
          <span className="text-[10px] font-black tracking-[0.2em] text-blue-500/80">HORIZON SENTINEL V1.0</span>
        </div>

        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <m.icon size={12} className={cn("opacity-50", m.color)} />
            <div className="flex flex-col">
              <span className="text-[8px] font-black tracking-widest text-white/30 leading-none mb-0.5">{m.label}</span>
              <span className={cn("text-[10px] font-mono font-bold leading-none tracking-tighter", m.color)}>
                {m.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:flex items-center gap-4 border-l border-white/10 pl-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-mono font-bold text-emerald-500/80 tracking-tighter">ENCRYPTED_TUNNEL: ACTIVE</span>
        </div>
        <div className="text-[10px] font-mono text-white/20 font-bold tracking-tighter">
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </div>
      </div>
    </div>
  );
};

export default SystemStatusBar;
