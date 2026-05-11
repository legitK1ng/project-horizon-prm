import {
  Sparkles,
  FileJson,
  Activity,
  Shield,
  Zap,
  Terminal,
  Cpu,
  RefreshCw,
  Database
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIngestCall } from "../hooks/useHorizonData";
import toast from "react-hot-toast";

const IntelligenceWorkbench: React.FC = () => {
  const [ingestMode, setIngestMode] = useState<"manual" | "acr">("manual");
  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetry, setTelemetry] = useState<string[]>([]);
  const ingestMutation = useIngestCall();
  const scrollRef = useRef<HTMLDivElement>(null);

  const addTelemetry = (msg: string) => {
    setTelemetry(prev => [...prev.slice(-4), `> ${msg}`]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [telemetry]);

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const payload = {
      contact_name: formData.get("name") as string,
      phone_number: formData.get("phone") as string,
      transcript: formData.get("transcript") as string,
      timestamp: new Date().toISOString()
    };

    if (!payload.transcript) {
        toast.error("DATA INPUT REQUIRED: TRANSCRIPT EMPTY");
        return;
    }

    setIsProcessing(true);
    addTelemetry("INITIALIZING NEURAL LINK...");
    addTelemetry(`TARGET: ${payload.contact_name || 'UNKNOWN'}`);
    
    try {
      addTelemetry("SENDING DATA TO GEMINI CORE...");
      await ingestMutation.mutateAsync(payload);
      addTelemetry("SUCCESS: INTELLIGENCE SYNTHESIZED");
      toast.success("Intelligence Briefing Generated!");
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      addTelemetry("CRITICAL ERROR: UPLINK FAILED");
      toast.error("Analysis Failed. Check the backend.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <motion.div
        className={cn(
          "relative overflow-hidden group",
          "glass-premium p-1 border-white/10 dark:border-white/5",
          "shadow-2xl shadow-black/50"
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 } as const}
      >
        {/* 📟 Interior Container */}
        <div className="relative z-10 bg-slate-900/40 dark:bg-black/60 rounded-[2.4rem] p-8 overflow-hidden">
          {/* 📡 Scanline Overlay */}
          <div className="absolute inset-0 pointer-events-none scanline opacity-[0.03]" />
          
          {/* 🔘 Data Grid Background */}
          <div className="absolute inset-0 bg-grid opacity-[0.05] pointer-events-none" />

          {/* 🛠️ Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-horizon-500 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-horizon-500/50 animate-pulse delay-75" />
                  <div className="w-1.5 h-1.5 rounded-full bg-horizon-500/20 animate-pulse delay-150" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-horizon-500 italic">Sector 7 // Lab 01</span>
              </div>
              <h3 className="text-3xl font-black flex items-center gap-3 italic uppercase tracking-tighter text-white">
                <Cpu className="w-8 h-8 text-horizon-500" />
                Intelligence <span className="text-horizon-500 not-italic">Ingestion Lab</span>
              </h3>
            </div>

            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
              {[
                { id: "manual", label: "Manual Analysis", icon: Terminal },
                { id: "acr", label: "ACR Bulk Handoff", icon: Database }
              ].map((mode) => (
                <button 
                  key={mode.id}
                  onClick={() => setIngestMode(mode.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                    ingestMode === mode.id 
                      ? "bg-horizon-500 text-white shadow-glow" 
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <mode.icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* 📝 Input Panel */}
            <div className="lg:col-span-7 space-y-6">
              <AnimatePresence mode="wait">
                {ingestMode === "manual" ? (
                  <motion.form 
                    key="manual"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onSubmit={handleManualIngest} 
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 italic">Entity Designation</label>
                        <div className="relative">
                          <input 
                            name="name" 
                            placeholder="NAME / ALIAS" 
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-horizon-500/50 transition-all placeholder:text-slate-700"
                            required
                          />
                          <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-800" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 italic">Signal Origin</label>
                        <div className="relative">
                          <input 
                            name="phone" 
                            placeholder="SIGNAL ID (PHONE)" 
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-horizon-500/50 transition-all placeholder:text-slate-700"
                          />
                          <Activity className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-800" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 italic">Signal Content (Transcript)</label>
                      <textarea 
                        name="transcript" 
                        placeholder="INPUT RAW TRANSCRIPTION DATA FOR NEURAL PROCESSING..." 
                        className="w-full h-48 bg-black/40 border border-white/5 rounded-[2rem] px-8 py-6 text-sm font-mono font-bold text-horizon-400 outline-none focus:border-horizon-500/50 transition-all placeholder:text-slate-800 resize-none leading-relaxed"
                        required
                      ></textarea>
                    </div>

                    <motion.button 
                      type="submit" 
                      disabled={isProcessing || ingestMutation.isPending}
                      whileHover={{ scale: 1.01, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "w-full flex items-center justify-center gap-3 py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl",
                        "bg-gradient-to-r from-horizon-600 to-blue-700 text-white shadow-horizon-500/20",
                        "disabled:opacity-50 disabled:cursor-not-allowed group"
                      )}
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Zap className="w-5 h-5 group-hover:scale-125 transition-transform" />
                      )}
                      {isProcessing ? "PROCESSING NEURAL LINK..." : "Initialize Intelligence Handoff"}
                    </motion.button>
                  </motion.form>
                ) : (
                  <motion.div 
                    key="acr"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="py-12 text-center space-y-6 flex flex-col items-center justify-center h-full bg-black/20 rounded-[2rem] border border-dashed border-white/5"
                  >
                    <div className="w-24 h-24 bg-horizon-500/10 text-horizon-500 rounded-[2rem] flex items-center justify-center mb-4 border border-horizon-500/20 relative">
                      <div className="absolute inset-0 bg-horizon-500/20 blur-2xl rounded-full" />
                      <FileJson className="w-12 h-12 relative z-10" />
                    </div>
                    <h4 className="text-xl font-black italic uppercase tracking-tighter text-white">ACR Automated Pipeline</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                      Deploy structured JSON handoff via secure node environment. <br />
                      <span className="text-horizon-500">CMD: node scripts/ingest_acr_logs.js</span>
                    </p>
                    <div className="h-px w-24 bg-white/5" />
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-[8px] font-black text-emerald-500/70 uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Endpoint Online
                        </div>
                        <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Awaiting Signals
                        </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 📈 Telemetry / Info Panel */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-black/40 rounded-[2rem] border border-white/5 p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Telemetry Log</h4>
                  <Activity className="w-3.5 h-3.5 text-horizon-500" />
                </div>
                
                <div 
                  ref={scrollRef}
                  className="flex-1 min-h-[200px] bg-black/60 rounded-2xl p-6 font-mono text-[10px] leading-relaxed overflow-y-auto thin-scrollbar border border-white/5"
                >
                  <AnimatePresence>
                    {telemetry.length === 0 ? (
                      <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-slate-700 italic"
                      >
                        SYSTEM READY. AWAITING INPUT...
                      </motion.p>
                    ) : (
                      telemetry.map((line, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "mb-2",
                            line.includes("SUCCESS") ? "text-emerald-500" : 
                            line.includes("ERROR") ? "text-red-500" : "text-horizon-400"
                          )}
                        >
                          {line}
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-6 p-6 rounded-2xl bg-horizon-500/5 border border-horizon-500/10">
                   <div className="flex items-center gap-3 mb-3">
                      <Sparkles className="w-4 h-4 text-horizon-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-horizon-400">Core Intelligence</span>
                   </div>
                   <p className="text-[11px] text-slate-400 leading-relaxed font-bold italic">
                      "Manual ingestion allows for precise strategic briefing initialization. Paste any text-based interaction for real-time entity mapping and nudge generation."
                   </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default IntelligenceWorkbench;
