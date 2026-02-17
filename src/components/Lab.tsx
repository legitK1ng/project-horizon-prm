import React, { useState, useEffect } from 'react';
import { CallRecord, Persona } from '@/types';
import { BRAIN_PERSONAS, ICONS } from '@/constants';
import { Brain, Play, RefreshCw, Save, Activity, Server, CheckCircle, AlertTriangle } from 'lucide-react';
import { generateId } from '@/utils/helpers';
import { fetchModels, runBackendDiagnostics, testGeminiConnection, triggerProcessing, analyzeText } from '@/services/apiService';
import { connectionLogger, LogEntry as ServiceLogEntry } from '@/utils/connectionLogger';
import Console, { LogEntry } from './Console';

interface LabProps {
    onSaveLog?: (call: CallRecord) => void;
}

const Lab: React.FC<LabProps> = ({ onSaveLog }) => {
    const [transcript, setTranscript] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedPersona, setSelectedPersona] = useState<Persona['id']>(BRAIN_PERSONAS[0].id);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<CallRecord['executiveBrief'] | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'diagnostics'>('analysis');

    // Diagnostics State
    const [models, setModels] = useState<any[]>([]);
    const [diagResults, setDiagResults] = useState<any>(null);
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
        // connectionLogger.log(type, message, details); // Optional: sync back to service
        setLogs(prev => [...prev, newLog]);
    };

    const handleProcess = async () => {
        if (!transcript.trim()) return;

        setIsProcessing(true);
        setResult(null);

        try {
            const analysis = await analyzeText(transcript);
            setResult(analysis);
        } catch (error) {
            console.error(error);
            // Error handling is actually done inside analyzeText returning a fallback object, 
            // but if it throws we catch it here.
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = () => {
        if (result && onSaveLog) {
            const newCall: CallRecord = {
                id: generateId('call'),
                timestamp: new Date().toISOString(),
                contactName: 'Manual Entry', // Backend will resolve this if phone matches
                phoneNumber: phoneNumber,
                duration: 0,
                transcript: transcript,
                tags: result.tags || [],
                status: 'COMPLETED',
                executiveBrief: result
            };
            onSaveLog(newCall);
            // Reset
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
            addLog('INFO', 'Fetching Gemini Models...');
            const modelData = await fetchModels();
            if (modelData && modelData.models) {
                setModels(modelData.models);
                addLog('SUCCESS', `Fetched ${modelData.models.length} models`, modelData.models.map((m: any) => m.name));
            } else {
                addLog('WARNING', 'No models returned from backend');
            }

            addLog('INFO', 'Running Backend Integrity Tests...');
            const diagData = await runBackendDiagnostics();
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Processing Lab</h2>
                    <p className="text-slate-500 dark:text-slate-400">Test AI analysis and System Health.</p>
                </div>
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'analysis' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Analysis
                    </button>
                    <button
                        onClick={() => setActiveTab('diagnostics')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'diagnostics' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Diagnostics
                    </button>
                </div>
            </div>

            {activeTab === 'analysis' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input Column */}
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Phone Number (Optional)
                                </label>
                                <input
                                    type="text"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                    placeholder="e.g. 555-0123"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                />
                            </div>

                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Raw Call Transcript
                            </label>
                            <textarea
                                className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
                                placeholder="Paste transcript here..."
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                            />

                            <div className="mt-4 flex flex-wrap gap-2">
                                {BRAIN_PERSONAS.map(persona => (
                                    <button
                                        key={persona.id}
                                        onClick={() => setSelectedPersona(persona.id)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedPersona === persona.id
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                            }`}
                                    >
                                        {persona.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleProcess}
                                disabled={isProcessing || !transcript.trim()}
                                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none"
                            >
                                {isProcessing ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={20} />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Brain size={20} />
                                        Analyze Text
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Output Column */}
                    <div className="space-y-4">
                        {result ? (
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        {ICONS.Dashboard} Analysis Results
                                    </h3>
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Save size={16} />
                                        Save to Logs
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                        <h4 className="font-semibold text-emerald-800 dark:text-emerald-400 mb-1 text-sm uppercase">Summary</h4>
                                        <p className="text-slate-700 dark:text-slate-300">{result.summary}</p>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 text-sm uppercase">Action Items</h4>
                                        <ul className="space-y-2">
                                            {result.actionItems.map((item: string, i: number) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                    <div className="min-w-[4px] h-[4px] rounded-full bg-blue-500 mt-2" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 h-full flex flex-col items-center justify-center text-slate-400">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                    <Play size={24} className="ml-1 opacity-50" />
                                </div>
                                <p>Ready to analyze.</p>
                                <p className="text-xs mt-1">Select a persona and click Analyze.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">System Diagnostics</h3>
                                <p className="text-sm text-slate-500">Run backend tests and check API connectivity.</p>
                            </div>
                            <button
                                onClick={handleRunDiagnostics}
                                disabled={isLoadingDiag}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                {isLoadingDiag ? <RefreshCw className="animate-spin" size={16} /> : <Activity size={16} />}
                                Run Diagnostics
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Call Models */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Brain size={16} /> Available Models
                                </h4>
                                {models.length > 0 ? (
                                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                        {models.map((m, i) => (
                                            <div key={i} className="p-3 border-b border-slate-200 dark:border-slate-800 last:border-0 flex justify-between items-center">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{m.displayName}</span>
                                                <span className="text-xs text-slate-500 font-mono">{m.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
                                        No models loaded. Run diagnostics to fetch.
                                    </div>
                                )}
                            </div>

                            {/* Backend Tests */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Server size={16} /> Backend Integrity
                                </h4>
                                {diagResults ? (
                                    <div className="space-y-2">
                                        <div className={`p-3 rounded-lg border flex items-center gap-3 ${diagResults.status === 'healthy'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                            : 'bg-amber-50 border-amber-200 text-amber-800'
                                            }`}>
                                            {diagResults.status === 'healthy' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                            <span className="font-bold uppercase text-sm">{diagResults.status}</span>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                            {diagResults.results?.map((r: any, i: number) => (
                                                <div key={i} className="p-3 border-b border-slate-200 dark:border-slate-800 last:border-0 flex justify-between items-center text-sm">
                                                    <span className="text-slate-700 dark:text-slate-300">{r.test}</span>
                                                    {r.status === 'PASS' ? (
                                                        <span className="text-emerald-600 font-bold text-xs bg-emerald-100 px-2 py-0.5 rounded-full">PASS</span>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-red-500 text-xs">{r.message}</span>
                                                            <span className="text-red-600 font-bold text-xs bg-red-100 px-2 py-0.5 rounded-full">FAIL</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
                                        No diagnostic results. Run diagnostics to test.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Gemini Integration Section */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Brain size={20} className="text-purple-500" /> Gemini Integration
                            </h3>
                            <div className="flex gap-4">
                                <button
                                    onClick={async () => {
                                        addLog('INFO', 'Testing Gemini Connection...');
                                        const res = await testGeminiConnection();
                                        if (res?.status === 'success' || res?.candidates) {
                                            addLog('SUCCESS', 'Gemini Connection Verified', res);
                                        } else {
                                            addLog('ERROR', 'Gemini Connection Failed', res);
                                        }
                                    }}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Test Connection
                                </button>
                                <button
                                    onClick={async () => {
                                        addLog('INFO', 'Triggering Background Processing...');
                                        const res = await triggerProcessing();
                                        addLog('INFO', 'Trigger Result', res);
                                    }}
                                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Force Process Queue
                                </button>
                            </div>
                        </div>

                        {/* NEW CONSOLE SECTION */}
                        <div className="mt-8">
                            <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <Activity size={16} /> Live System Monitor
                            </h4>
                            <Console
                                logs={logs}
                                onClear={() => setLogs([])}
                                isRunning={isLoadingDiag}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Lab;
