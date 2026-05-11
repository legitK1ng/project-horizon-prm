import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CallRecord, Persona } from '@/types';
import { BRAIN_PERSONAS } from '@/constants';
import { Brain, Play, RefreshCw, Activity, Server, CheckCircle, AlertTriangle, Upload, Sparkles, Zap, Bot, Target } from 'lucide-react';
import { generateId } from '@/utils/helpers';
import { api } from '@/services/apiClient';
import { connectionLogger, LogEntry as ServiceLogEntry } from '@/utils/connectionLogger';
import Console, { LogEntry } from './Console';
import { WebNative, NativeContext } from '@/services/WebNative';
import GlassCard from './common/GlassCard';
import PremiumButton from './common/PremiumButton';
import { cn } from '@/utils/ui';

interface LabProps {
    onSaveLog?: (call: CallRecord) => void;
}

const Lab: React.FC<LabProps> = ({ onSaveLog }) => {
    const [transcript, setTranscript] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedPersona, setSelectedPersona] = useState<Persona['id']>(BRAIN_PERSONAS[0].id);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<CallRecord['executive_brief'] | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'diagnostics'>('analysis');
    const [isDragging, setIsDragging] = useState(false);

    // Diagnostics State
    const [models, setModels] = useState<any[]>([]);
    const [diagResults, setDiagResults] = useState<any>(null);
    const [nativeContext, setNativeContext] = useState<NativeContext | null>(null);
    const [isLoadingDiag, setIsLoadingDiag] = useState(false);

    // Console State
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        // Subscribe to connection logger
        const unsubscribe = connectionLogger.subscribe((newLogs: ServiceLogEntry[]) => {
            // Transform connection logs to Console logs
            const formattedLogs: LogEntry[] = newLogs.map((l) => {
                let type: LogEntry['type'] = 'INFO';
                if (l.type === 'error') type = 'ERROR';
                if (l.type === 'success') type = 'SUCCESS';
                if (l.type === 'warning') type = 'WARNING';

                return {
                    timestamp: l.timestamp,
                    type: type,
                    message: l.message,
                    details: l.details
                };
            });
            setLogs(formattedLogs);
        });
        return () => unsubscribe();
    }, []);

    const addLog = (type: LogEntry['type'], message: string, details?: any) => {
        const newLog: LogEntry = {
            timestamp: new Date().toISOString(),
            type,
            message,
            details
        };
        setLogs(prev => [...prev, newLog]);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files.item(0);
            if (!file) return;
            if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const text = event.target?.result as string;
                    if (text) {
                        setTranscript(text);
                        addLog('SUCCESS', `Loaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
                    }
                };
                reader.onerror = () => {
                    addLog('ERROR', `Failed to read file: ${file.name}`);
                };
                reader.readAsText(file);
            } else {
                addLog('WARNING', `Unsupported file type: ${file.type || file.name}. Only text files are supported.`);
            }
        }

        const droppedText = e.dataTransfer.getData('text/plain');
        if (droppedText && files.length === 0) {
            setTranscript(droppedText);
            addLog('SUCCESS', 'Loaded dropped text');
        }
    };

    const handleProcess = async () => {
        if (!transcript.trim()) return;

        setIsProcessing(true);
        setResult(null);

        try {
            const analysis = await api.analyzeText(transcript);
            setResult(analysis);
            addLog('SUCCESS', 'Neural analysis complete', analysis);
        } catch (error: any) {
            console.error(error);
            addLog('ERROR', 'Analysis failed', error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = () => {
        if (result && onSaveLog) {
            const newCall: CallRecord = {
                id: generateId('call'),
                contact_id: 'manual', 
                timestamp: new Date().toISOString(),
                contact_name: 'Manual Entry',
                phone_number: phoneNumber,
                duration: 0,
                transcript: transcript,
                tags: result.tags || [],
                status: 'COMPLETED',
                executive_brief: result
            };
            onSaveLog(newCall);
            addLog('SUCCESS', 'Analysis saved to intelligence repository');
            setTranscript('');
            setPhoneNumber('');
            setResult(null);
        }
    };

    const handleRunDiagnostics = async () => {
        setIsLoadingDiag(true);
        addLog('INFO', 'Starting Diagnostics...', { timestamp: new Date() });
        setModels([]);
        setDiagResults(null);

        try {
            addLog('NATIVE', 'Fetching Native Device Context...');
            const context = await WebNative.getNativeContext();
            setNativeContext(context);
            addLog('NATIVE', `Fetched Native Context (${context.deviceInfo.platform})`, context);

            addLog('INFO', 'Fetching Gemini Models...');
            const models = await api.fetchModels();
            if (models && models.length > 0) {
                setModels(models);
                addLog('SUCCESS', `Fetched ${models.length} models`, models.map((m: any) => m.name));
            } else {
                addLog('WARNING', 'No models returned from backend');
            }

            addLog('INFO', 'Running Backend Integrity Tests...');
            const diagData = await api.runDiagnostics();
            if (diagData) {
                setDiagResults(diagData);
                if (diagData.status === 'healthy') {
                    addLog('SUCCESS', 'Backend Tests Passed', diagData);
                } else {
                    addLog('ERROR', 'Backend Tests Failed', diagData);
                }
            }
        } catch (error: any) {
            console.error(error);
            addLog('ERROR', 'Diagnostics Exception', error.message);
        } finally {
            setIsLoadingDiag(false);
            addLog('INFO', 'Diagnostics Complete');
        }
    };

    return (
        <div className="space-y-10 animate-reveal">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-600/10 rounded-2xl border border-purple-600/20 shadow-inner">
                            <Brain size={24} className="text-purple-500" />
                        </div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-purple-500/80 italic">NEURAL_PROCESSOR_v4.2</h2>
                    </div>
                    <h1 className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic leading-none">
                        Intelligence<span className="text-purple-600">.</span>Lab
                    </h1>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-[1.5rem] border border-slate-200 dark:border-white/5 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('analysis')}
                        className={cn(
                            "px-8 py-3 rounded-[1.2rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500",
                            activeTab === 'analysis' 
                                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-premium border border-slate-200 dark:border-white/10" 
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        ANALYSIS
                    </button>
                    <button 
                        onClick={() => setActiveTab('diagnostics')}
                        className={cn(
                            "px-8 py-3 rounded-[1.2rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500",
                            activeTab === 'diagnostics' 
                                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-premium border border-slate-200 dark:border-white/10" 
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        DIAGNOSTICS
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <GlassCard className="p-8 border-emerald-500/10 bg-emerald-500/5 hover:border-emerald-500/30 transition-all duration-500">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/60 mb-2 italic">Pipeline_Status</p>
                            <p className="text-3xl font-black text-emerald-500 uppercase tracking-tighter italic leading-none">OPERATIONAL</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-glow-emerald border border-emerald-500/20">
                            <Activity size={28} />
                        </div>
                    </div>
                    <div className="mt-8 h-1 w-full bg-emerald-500/10 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-emerald-500 shadow-glow-emerald"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        />
                    </div>
                </GlassCard>

                <GlassCard className="p-8 border-blue-500/10 bg-blue-500/5 hover:border-blue-500/30 transition-all duration-500">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/60 mb-2 italic">Neural_Load</p>
                            <p className="text-3xl font-black text-blue-500 uppercase tracking-tighter italic leading-none">OPTIMIZED</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500 shadow-glow border border-blue-500/20">
                            <Zap size={28} />
                        </div>
                    </div>
                    <div className="mt-8 flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className={cn("h-1 flex-1 rounded-full", i <= 3 ? "bg-blue-500 shadow-glow" : "bg-blue-500/10")} />
                        ))}
                    </div>
                </GlassCard>

                <GlassCard className="p-8 border-purple-500/10 bg-purple-500/5 hover:border-purple-500/30 transition-all duration-500">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500/60 mb-2 italic">Agent_Matrix</p>
                            <p className="text-3xl font-black text-purple-500 uppercase tracking-tighter italic leading-none">4_ACTIVE</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-500 shadow-glow border border-purple-500/20">
                            <Bot size={28} />
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                        <div className="flex -space-x-3">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-6 h-6 rounded-full bg-slate-900 border border-purple-500/30 flex items-center justify-center shadow-lg">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                </div>
                            ))}
                        </div>
                        <span className="text-[10px] font-black text-purple-500/60 uppercase tracking-widest italic">Monitoring_Swarm</span>
                    </div>
                </GlassCard>
            </div>

            {activeTab === 'analysis' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Input Column */}
                    <div className="space-y-6">
                        <GlassCard className="p-10 border-white/5 glass-premium shadow-premium overflow-visible">
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 italic mb-4">
                                        Subject_Reference (Optional)
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            className="w-full p-5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 outline-none font-mono text-sm transition-all shadow-inner"
                                            placeholder="e.g. +1 555-0123"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                        />
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                                            <Target size={18} className="text-purple-500" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 italic mb-4">
                                        Neural_Input_Feed
                                    </label>
                                    <div
                                        className={`relative rounded-[2rem] transition-all group ${isDragging ? 'scale-[1.02]' : ''}`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <div className="absolute -inset-1 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-[2.1rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                        <textarea
                                            className="w-full h-80 p-8 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-[2rem] focus:ring-0 outline-none resize-none font-mono text-sm relative z-10 transition-all shadow-inner luxury-scroll"
                                            placeholder="Paste transcript stream here or drag & drop intelligence file..."
                                            value={transcript}
                                            onChange={(e) => setTranscript(e.target.value)}
                                        />
                                        {isDragging && (
                                            <div className="absolute inset-0 bg-purple-600/10 backdrop-blur-md rounded-[2rem] flex flex-col items-center justify-center pointer-events-none z-20 border-2 border-dashed border-purple-500 animate-reveal">
                                                <div className="p-6 bg-purple-600 rounded-full shadow-glow-purple mb-4">
                                                    <Upload size={32} className="text-white" />
                                                </div>
                                                <p className="text-lg font-black text-white uppercase tracking-[0.2em] italic">Drop_Intelligence_File</p>
                                                <p className="text-[10px] font-bold text-purple-400 mt-2 uppercase tracking-widest">Supported: .txt, .json, .csv, .md</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 italic mb-4">
                                        Model_Persona_Core
                                    </label>
                                    <div className="flex flex-wrap gap-3">
                                        {BRAIN_PERSONAS.map(persona => (
                                            <button
                                                key={persona.id}
                                                onClick={() => setSelectedPersona(persona.id)}
                                                className={cn(
                                                    "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 border italic",
                                                    selectedPersona === persona.id
                                                        ? "bg-purple-600 text-white border-purple-600 shadow-glow-purple scale-105"
                                                        : "bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-purple-500/40 hover:text-purple-400"
                                                )}
                                            >
                                                {persona.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleProcess}
                                    disabled={isProcessing || !transcript.trim()}
                                    className="w-full py-6 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed text-white dark:text-black rounded-[2rem] font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 shadow-2xl overflow-hidden relative group/btn italic"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                    <span className="relative z-10 flex items-center gap-4">
                                        {isProcessing ? (
                                            <>
                                                <RefreshCw className="animate-spin" size={20} />
                                                SYNCHRONIZING_MATRIX...
                                            </>
                                        ) : (
                                            <>
                                                <Brain size={20} />
                                                INITIATE_NEURAL_UPLINK
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Output Column */}
                    <div className="space-y-6">
                        {result ? (
                            <GlassCard className="p-10 border-white/5 glass-premium shadow-premium animate-reveal">
                                <div className="flex items-center justify-between mb-10 pb-8 border-b border-white/5">
                                    <div className="flex items-center gap-5">
                                        <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-500 shadow-glow-emerald">
                                            <Sparkles size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">Analysis_Result</h3>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 italic opacity-60">Confidence Score: 0.9882</p>
                                        </div>
                                    </div>
                                    <PremiumButton 
                                        onClick={handleSave}
                                        variant="primary"
                                        size="sm"
                                        className="px-6 shadow-glow"
                                    >
                                        SAVE_LOG
                                    </PremiumButton>
                                </div>

                                <div className="space-y-10">
                                    <div className="p-8 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                                            <Activity size={48} className="text-emerald-500" />
                                        </div>
                                        <h4 className="text-[11px] font-black text-emerald-500/80 uppercase tracking-[0.3em] mb-4 italic leading-none">Intelligence_Summary</h4>
                                        <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-relaxed tracking-tight">{result.summary}</p>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-4 mb-6">
                                            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] italic leading-none">Action_Protocol_Items</h4>
                                            <div className="h-px flex-1 bg-white/5" />
                                        </div>
                                        <div className="space-y-4">
                                            {(result.action_items || []).map((item: string, i: number) => (
                                                <motion.div 
                                                    key={i} 
                                                    initial={{ opacity: 0, x: 10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                    className="flex items-start gap-5 p-5 bg-white/5 rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-all shadow-sm"
                                                >
                                                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/20 group-hover:scale-110 transition-transform">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-glow" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-200 transition-colors leading-relaxed">{item}</span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {(result.tags || []).map((tag, i) => (
                                            <span key={i} className="px-4 py-1.5 bg-slate-100 dark:bg-white/5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest rounded-full border border-slate-200 dark:border-white/5 italic">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </GlassCard>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center">
                                <div className="w-full h-full min-h-[500px] border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem] flex flex-col items-center justify-center text-slate-400 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                    <div className="w-32 h-32 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-10 shadow-inner border border-slate-100 dark:border-white/5 relative z-10 group-hover:scale-110 transition-transform duration-700">
                                        <Play size={40} className="ml-2 text-slate-300 dark:text-slate-700 group-hover:text-purple-500 transition-colors" />
                                        <div className="absolute inset-0 rounded-full border border-purple-500/20 animate-ping opacity-0 group-hover:opacity-100" />
                                    </div>
                                    <p className="text-xl font-black uppercase tracking-[0.2em] italic text-slate-300 dark:text-slate-700 relative z-10">Neural_Processor_Ready</p>
                                    <p className="text-[10px] font-bold mt-4 uppercase tracking-[0.4em] text-slate-400 opacity-60 relative z-10">Select parameters and initiate uplink</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-10 animate-reveal">
                    <GlassCard className="p-10 border-white/5 glass-premium shadow-premium relative overflow-hidden">
                        <div className="absolute inset-0 scanline opacity-20 pointer-events-none" />
                        <div className="flex justify-between items-center mb-12 relative z-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">System_Diagnostics</h3>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 italic opacity-60">Full Spectrum Infrastructure Health Check</p>
                            </div>
                            <button
                                onClick={handleRunDiagnostics}
                                disabled={isLoadingDiag}
                                className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] italic transition-all flex items-center gap-4 shadow-glow active:scale-95 disabled:opacity-50"
                            >
                                {isLoadingDiag ? <RefreshCw className="animate-spin" size={20} /> : <Activity size={20} />}
                                START_DIAGNOSTICS
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                            {/* Models Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-500">
                                        <Brain size={18} />
                                    </div>
                                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Available_Neural_Models</h4>
                                </div>
                                {models.length > 0 ? (
                                    <div className="bg-black/20 rounded-[2rem] overflow-hidden border border-white/5 shadow-inner luxury-scroll max-h-[400px] overflow-y-auto">
                                        {models.map((m, i) => (
                                            <div key={i} className="p-6 border-b border-white/5 last:border-0 flex justify-between items-center hover:bg-white/5 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-2 h-2 rounded-full bg-purple-500/40 group-hover:bg-purple-500 shadow-glow-purple transition-all" />
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-white transition-colors">{m.displayName}</span>
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-500 group-hover:text-purple-400 transition-colors">{m.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-16 text-center bg-black/10 rounded-[2rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-6">
                                        <Brain size={48} className="text-slate-800 animate-pulse" />
                                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.3em] italic">No_Neural_Context_Loaded</p>
                                    </div>
                                )}
                            </div>

                            {/* Integrity Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-500">
                                        <Server size={18} />
                                    </div>
                                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Backend_Matrix_Integrity</h4>
                                </div>
                                {diagResults ? (
                                    <div className="space-y-4">
                                        <div className={cn(
                                            "p-6 rounded-2xl border flex items-center gap-5 shadow-lg animate-reveal",
                                            diagResults.status === 'healthy'
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-glow-emerald'
                                                : 'bg-amber-500/10 border-amber-200 text-amber-500 shadow-glow-warn'
                                        )}>
                                            {diagResults.status === 'healthy' ? <CheckCircle size={28} /> : <AlertTriangle size={28} />}
                                            <div>
                                                <span className="block text-[10px] font-black uppercase tracking-[0.2em] opacity-60 leading-none mb-1">Core_Status</span>
                                                <span className="text-2xl font-black italic tracking-tighter uppercase leading-none">{diagResults.status}</span>
                                            </div>
                                        </div>

                                        <div className="bg-black/20 rounded-[2rem] overflow-hidden border border-white/5 shadow-inner max-h-[280px] overflow-y-auto luxury-scroll">
                                            {diagResults.results?.map((r: any, i: number) => (
                                                <div key={i} className="p-5 border-b border-white/5 last:border-0 flex justify-between items-center text-sm hover:bg-white/5 transition-all">
                                                    <span className="text-slate-700 dark:text-slate-300 font-bold tracking-tight">{r.test}</span>
                                                    {r.status === 'PASS' ? (
                                                        <span className="text-[9px] font-black tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg italic">PASS</span>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-red-400 text-[10px] font-bold italic">{r.message}</span>
                                                            <span className="text-[9px] font-black tracking-widest text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg italic uppercase">FAIL</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-16 text-center bg-black/10 rounded-[2rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-6">
                                        <Server size={48} className="text-slate-800 animate-pulse" />
                                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.3em] italic">Awaiting_Integrity_Verification</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* WebNative Context Section */}
                        {nativeContext && (
                            <motion.div 
                                className="bg-white/5 p-10 rounded-[2.5rem] border border-white/5 shadow-inner mt-12 relative z-10 group"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <div className="flex items-center justify-between mb-10">
                                    <h4 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-4">
                                        <Activity size={24} className="text-blue-500" /> 
                                        WebNative_Extension_Payload
                                    </h4>
                                    <div className="px-5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest italic">
                                        ACTIVE_LINK
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                    <div className="p-6 bg-black/20 rounded-[1.5rem] border border-white/5 group-hover:border-blue-500/20 transition-all">
                                        <p className="text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest italic">Platform_Core</p>
                                        <p className="text-lg font-black text-white italic tracking-tight capitalize">{nativeContext.deviceInfo.platform}</p>
                                    </div>
                                    <div className="p-6 bg-black/20 rounded-[1.5rem] border border-white/5 group-hover:border-blue-500/20 transition-all">
                                        <p className="text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest italic">Hardware_Model</p>
                                        <p className="text-lg font-black text-white italic tracking-tight">{nativeContext.deviceInfo.model}</p>
                                    </div>
                                    <div className="p-6 bg-black/20 rounded-[1.5rem] border border-white/5 group-hover:border-blue-500/20 transition-all">
                                        <p className="text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest italic">Battery_Opt</p>
                                        <p className="text-lg font-black text-blue-400 italic tracking-tight uppercase">{nativeContext.isBatteryOptimized ? 'Optimized' : 'Unrestricted'}</p>
                                    </div>
                                    <div className="col-span-2 md:col-span-3 p-8 bg-black/20 rounded-[2rem] border border-white/5 group-hover:border-blue-500/20 transition-all">
                                        <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest italic">Neural_Permissions_Matrix</p>
                                        <div className="flex gap-10">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-3 h-3 rounded-full shadow-glow",
                                                    nativeContext.permissions.contacts === 'granted' ? 'bg-emerald-500 shadow-glow-emerald' : 'bg-red-500 shadow-glow-red'
                                                )}></div>
                                                <span className="text-sm font-black text-white italic tracking-widest uppercase">CONTACTS_ACCESS</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-3 h-3 rounded-full shadow-glow",
                                                    nativeContext.permissions.calls === 'granted' ? 'bg-emerald-500 shadow-glow-emerald' : 'bg-red-500 shadow-glow-red'
                                                )}></div>
                                                <span className="text-sm font-black text-white italic tracking-widest uppercase">CALL_LOGS_ACCESS</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </GlassCard>

                    {/* Gemini Integration Section */}
                    <GlassCard className="p-10 border-purple-500/10 bg-purple-500/5 shadow-premium group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="flex items-center gap-6">
                                <div className="p-5 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-500 group-hover:scale-110 transition-transform">
                                    <Sparkles size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">Gemini_Direct_Link</h3>
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 italic opacity-60">High-Fidelity AI Interconnect</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={async () => {
                                        addLog('INFO', 'Testing Gemini Connection...');
                                        const res = await api.testGeminiConnection();
                                        if (res?.status === 'success' || res?.candidates) {
                                            addLog('SUCCESS', 'Gemini Connection Verified', res);
                                        } else {
                                            addLog('ERROR', 'Gemini Connection Failed', res);
                                        }
                                    }}
                                    className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] italic transition-all shadow-glow-purple active:scale-95"
                                >
                                    VERIFY_UPLINK
                                </button>
                                <button
                                    onClick={async () => {
                                        addLog('INFO', 'Triggering Background Processing...');
                                        const res = await api.triggerProcessing();
                                        addLog('INFO', 'Trigger Result', res);
                                    }}
                                    className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-100 rounded-[1.5rem] font-black uppercase tracking-[0.2em] italic transition-all shadow-premium active:scale-95"
                                >
                                    FORCE_QUEUE_FLUSH
                                </button>
                            </div>
                        </div>
                    </GlassCard>

                    {/* LIVE SYSTEM MONITOR */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 px-4">
                            <div className="w-8 h-px bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-700" />
                            <Activity size={18} className="text-slate-500" />
                            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] italic leading-none">Live_System_Monitor_Feed</h4>
                            <div className="w-24 h-px bg-gradient-to-r from-slate-300 dark:from-slate-700 to-transparent" />
                        </div>
                        <Console
                            logs={logs}
                            onClear={() => setLogs([])}
                            isRunning={isLoadingDiag}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Lab;
