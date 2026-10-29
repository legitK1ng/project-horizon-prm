import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Activity, Zap, Database, RefreshCw, Cpu,
  CheckCircle2, Network, ChevronRight, Terminal, Fingerprint,
  AlertTriangle, Play, Radio, Server, Wifi, Flame, RotateCcw,
  Sparkles, Lock, ArrowUpRight, Check, X
} from 'lucide-react';

const INITIAL_SERVICES = [
  {
    id: 'fastapi',
    name: 'FastAPI Ingestion Core',
    host: 'HP-Z2G3 (100.90.84.53:8000)',
    status: 'nominal',
    load: 14,
    latency: '18ms',
    uptime: '99.98%',
    description: 'ACR phone Whisper-mimic listener with run_in_executor offloading'
  },
  {
    id: 'tailscale',
    name: 'Tailscale Encrypted Mesh',
    host: 'tailnet-horizon.ts.net',
    status: 'nominal',
    load: 8,
    latency: '24ms',
    uptime: '100%',
    description: 'WireGuard encrypted tunnel with Funnel public ingress proxy'
  },
  {
    id: 'gemini',
    name: 'Gemini Neural Processor',
    host: 'gemini-2.5-flash',
    status: 'nominal',
    load: 22,
    latency: '412ms',
    uptime: '99.95%',
    description: 'Autonomous call summarization, executive brief distillation & action extractor'
  },
  {
    id: 'supabase',
    name: 'Supabase Vector Database',
    host: 'db.supabase.co (pgvector)',
    status: 'nominal',
    load: 19,
    latency: '62ms',
    uptime: '99.99%',
    description: 'Relational call records, contact dossiers, and pgvector semantic embeddings'
  },
  {
    id: 'people_api',
    name: 'Google People OSINT Sync',
    host: 'people.googleapis.com',
    status: 'nominal',
    load: 4,
    latency: '88ms',
    uptime: '99.90%',
    description: 'Bi-directional contact synchronization and biographical OSINT enrichment'
  },
  {
    id: 'dexie',
    name: 'Dexie Offline Cache',
    host: 'IndexedDB (Browser Local)',
    status: 'nominal',
    load: 2,
    latency: '2ms',
    uptime: '100%',
    description: 'Zero-latency offline first store with background dual-sync replication'
  }
];

const INITIAL_LOGS = [
  { id: 'l-1', time: '18:24:10', level: 'INFO', system: 'FASTAPI', message: 'ACR Phone Whisper-mimic endpoint listening on 0.0.0.0:8000/api/whisper-mimic' },
  { id: 'l-2', time: '18:24:12', level: 'SUCCESS', system: 'TAILNET', message: 'Tailscale Funnel proxy established: https://horizon-edge.tailnet.ts.net' },
  { id: 'l-3', time: '18:24:15', level: 'INFO', system: 'SENTINEL', message: 'Autonomous Guardian monitor heartbeat started. Polling every 5000ms' },
  { id: 'l-4', time: '18:24:20', level: 'SUCCESS', system: 'SUPABASE', message: 'Connection pool verified: 12 active workers, 0 pool exhaustion warnings' },
  { id: 'l-5', time: '18:24:28', level: 'INFO', system: 'GEMINI', message: 'Model context primed (gemini-2.5-flash). System prompt cached' }
];

export default function SentinelGuardianView() {
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [logFilter, setLogFilter] = useState('ALL');
  const [healingRunning, setHealingRunning] = useState(false);
  const [simulatingIngest, setSimulatingIngest] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const terminalEndRef = useRef(null);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Add Log Entry
  const appendLog = (level, system, message) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const newEntry = {
      id: `l-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      time,
      level,
      system,
      message
    };
    setLogs(prev => [newEntry, ...prev.slice(0, 49)]);
  };

  // Self Healing Routine Simulation
  const runSelfHealing = () => {
    if (healingRunning) return;
    setHealingRunning(true);
    appendLog('INFO', 'SENTINEL', 'Initiating autonomous cluster diagnostics and self-healing sweep...');

    setTimeout(() => {
      appendLog('INFO', 'SUPABASE', 'Analyzing pgvector indices and table vacuum states...');
      setServices(prev => prev.map(s => s.id === 'supabase' ? { ...s, status: 'optimizing' } : s));
    }, 800);

    setTimeout(() => {
      appendLog('SUCCESS', 'SUPABASE', 'Re-indexed call_records_embedding_idx (18,420 rows scanned, 0 errors)');
      appendLog('INFO', 'FASTAPI', 'Flushing stale audio multipart upload temporary buffers...');
      setServices(prev => prev.map(s => s.id === 'supabase' ? { ...s, status: 'nominal' } : s));
    }, 1800);

    setTimeout(() => {
      appendLog('SUCCESS', 'FASTAPI', 'Temp buffer purged: 142 MB reclaimed from C:\\temp\\horizon_audio');
      appendLog('SUCCESS', 'SENTINEL', 'Self-healing routine concluded. All 6 nodes aligned at 100% health.');
      setHealingRunning(false);
      triggerToast('Autonomous Self-Healing Cycle Complete (0 errors)');
    }, 2800);
  };

  // Simulate Inbound ACR Call
  const simulateInboundCall = () => {
    if (simulatingIngest) return;
    setSimulatingIngest(true);
    triggerToast('Incoming ACR Audio Telemetry Detected...');

    appendLog('INFO', 'FASTAPI', 'POST /api/whisper-mimic received: multipart/form-data [call_elena_20261029.m4a, 4.8MB]');

    setTimeout(() => {
      appendLog('INFO', 'FASTAPI', 'Handshake authenticated: secret_token verified via HP-Z2G3 vault');
      appendLog('INFO', 'WHISPER', 'Offloaded audio transcription to run_in_executor worker thread (Event loop unblocked)');
    }, 1000);

    setTimeout(() => {
      appendLog('SUCCESS', 'WHISPER', 'Audio transcribed (18m 42s in 3.4s). Generating phonetic speaker diarization...');
      appendLog('INFO', 'GEMINI', 'Prompting Gemini 2.5 Flash for executive brief & structured tasks extraction...');
    }, 2200);

    setTimeout(() => {
      appendLog('SUCCESS', 'GEMINI', 'Executive brief synthesized (2 action items extracted, sentiment: 0.94 positive)');
      appendLog('SUCCESS', 'SUPABASE', 'Committed call record #102 & generated 768-dim embedding in 44ms');
      appendLog('SUCCESS', 'INGEST', 'ACR Phone pipeline cycle complete. Pushed 200 OK HTTP response to client.');
      setSimulatingIngest(false);
      triggerToast('ACR Call Processed & Indexed into Supabase');
    }, 3600);
  };

  const filteredLogs = logs.filter(l => {
    if (logFilter === 'ALL') return true;
    if (logFilter === 'INGEST') return l.system === 'FASTAPI' || l.system === 'WHISPER' || l.system === 'INGEST';
    if (logFilter === 'SENTINEL') return l.system === 'SENTINEL' || l.system === 'TAILNET';
    if (logFilter === 'AI') return l.system === 'GEMINI';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0E0D0B] text-stone-200 font-sans p-4 md:p-8 selection:bg-[#E8A656]/30">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#161512] border border-[#E8A656]/60 text-white px-5 py-3 rounded-xl shadow-2xl shadow-black/80">
          <Sparkles className="w-4 h-4 text-[#E8A656] animate-pulse" />
          <span className="text-xs font-mono">{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#E8A656] animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-[#E8A656] uppercase">
              PROJECT HORIZON PRM • SENTINEL GUARDIAN
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white flex items-center gap-3">
            System <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8A656] to-amber-200">Guardian</span>
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Autonomous cluster telemetry, Tailscale mesh status, event-loop watchdog, and real-time ACR pipeline monitor.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={simulateInboundCall}
            disabled={simulatingIngest}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161512] border border-[#E8A656]/40 text-[#E8A656] font-mono text-xs uppercase tracking-wider hover:bg-[#E8A656]/10 transition disabled:opacity-50"
          >
            <Radio className={`w-3.5 h-3.5 ${simulatingIngest ? 'animate-ping' : ''}`} />
            {simulatingIngest ? 'Simulating Call...' : 'Simulate Inbound ACR'}
          </button>

          <button
            onClick={runSelfHealing}
            disabled={healingRunning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E8A656] to-amber-600 text-stone-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition shadow-lg shadow-[#E8A656]/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${healingRunning ? 'animate-spin' : ''}`} />
            {healingRunning ? 'Healing Cluster...' : 'Run Self-Healing Sweep'}
          </button>
        </div>
      </div>

      {/* CLUSTER TELEMETRY STATUS BAR */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#12110F] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-stone-500">
            <span>Cluster Status</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-2">ALL NOMINAL</div>
          <div className="text-[11px] font-mono text-stone-500 mt-1">6 of 6 microservices green</div>
        </div>

        <div className="bg-[#12110F] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-stone-500">
            <span>Primary Node</span>
            <Server className="w-3.5 h-3.5 text-[#E8A656]" />
          </div>
          <div className="text-lg font-bold font-mono text-white mt-2">HP-Z2G3</div>
          <div className="text-[11px] font-mono text-stone-500 mt-1">100.90.84.53 • Online</div>
        </div>

        <div className="bg-[#12110F] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-stone-500">
            <span>Mesh Relay Latency</span>
            <Wifi className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold font-mono text-[#E8A656] mt-2">24 ms</div>
          <div className="text-[11px] font-mono text-stone-500 mt-1">Tailscale Funnel Active</div>
        </div>

        <div className="bg-[#12110F] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-stone-500">
            <span>Event Loop Watchdog</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold font-mono text-white mt-2">0.2 ms / tick</div>
          <div className="text-[11px] font-mono text-emerald-400 mt-1">Unblocked • P0 Verified</div>
        </div>
      </div>

      {/* SERVICE HEALTH GRID */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-xs uppercase tracking-widest text-stone-400 font-bold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#E8A656]" />
            Component Topology & Microservice Health
          </h3>
          <span className="text-[11px] font-mono text-stone-500">Continuous telemetry feed</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(s => {
            const isNominal = s.status === 'nominal';
            return (
              <div
                key={s.id}
                className="bg-[#141310] border border-white/5 hover:border-[#E8A656]/30 rounded-xl p-4 transition shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-sm text-white">{s.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                      isNominal
                        ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                        : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                    }`}>
                      {s.status}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-[#E8A656] truncate mb-2">{s.host}</div>
                  <p className="text-xs text-stone-400 leading-relaxed mb-4">{s.description}</p>
                </div>

                <div className="pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-center text-[10px] font-mono text-stone-500">
                  <div>
                    <div>LOAD</div>
                    <div className="text-stone-300 font-bold mt-0.5">{s.load}%</div>
                  </div>
                  <div>
                    <div>LATENCY</div>
                    <div className="text-[#E8A656] font-bold mt-0.5">{s.latency}</div>
                  </div>
                  <div>
                    <div>UPTIME</div>
                    <div className="text-emerald-400 font-bold mt-0.5">{s.uptime}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REAL-TIME TERMINAL CONSOLE */}
      <div className="max-w-7xl mx-auto bg-[#12110F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="bg-[#161512] px-4 py-3 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#E8A656]" />
            <span className="font-mono text-xs uppercase font-bold tracking-wider text-white">
              Sentinel Live Telemetry Feed
            </span>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Streaming
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {['ALL', 'INGEST', 'SENTINEL', 'AI'].map(f => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition ${
                  logFilter === f
                    ? 'bg-[#E8A656] text-stone-950 font-bold'
                    : 'bg-white/5 text-stone-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal Log Stream */}
        <div className="p-4 font-mono text-xs space-y-1.5 max-h-[340px] overflow-y-auto bg-black/40">
          {filteredLogs.map(log => {
            const levelColor =
              log.level === 'SUCCESS' ? 'text-emerald-400' :
              log.level === 'WARN' ? 'text-amber-400' :
              log.level === 'ERROR' ? 'text-rose-400' : 'text-stone-400';

            return (
              <div key={log.id} className="flex items-start gap-3 hover:bg-white/5 py-0.5 px-1 rounded transition">
                <span className="text-stone-600 select-none text-[11px]">{log.time}</span>
                <span className="text-[#E8A656] font-bold text-[11px] min-w-[70px]">[{log.system}]</span>
                <span className={`text-[10px] uppercase font-bold min-w-[55px] ${levelColor}`}>{log.level}</span>
                <span className="text-stone-300 leading-relaxed flex-1">{log.message}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
