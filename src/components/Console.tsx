import React, { useEffect, useRef } from 'react';
import { Terminal, Activity, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export interface LogEntry {
    timestamp: string;
    type: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARNING';
    message: string;
    details?: any;
}

interface ConsoleProps {
    logs: LogEntry[];
    onClear: () => void;
    isRunning?: boolean;
}

const Console: React.FC<ConsoleProps> = ({ logs, onClear, isRunning }) => {
    const endRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'ERROR': return <AlertCircle size={14} className="text-red-400" />;
            case 'SUCCESS': return <CheckCircle2 size={14} className="text-green-400" />;
            case 'WARNING': return <AlertCircle size={14} className="text-yellow-400" />;
            default: return <Info size={14} className="text-blue-400" />;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'ERROR': return 'text-red-300 bg-red-900/10 border-red-900/20';
            case 'SUCCESS': return 'text-green-300 bg-green-900/10 border-green-900/20';
            case 'WARNING': return 'text-yellow-300 bg-yellow-900/10 border-yellow-900/20';
            default: return 'text-slate-300 border-slate-700/50';
        }
    };

    return (
        <div className="w-full h-96 bg-slate-900 rounded-lg border border-slate-700 flex flex-col font-mono text-sm shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
                <div className="flex items-center gap-2 text-slate-300">
                    <Terminal size={16} />
                    <span className="font-semibold tracking-wide text-xs uppercase">System Console</span>
                    {isRunning && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] border border-blue-500/20 animate-pulse">
                            <Activity size={10} />
                            RUNNING
                        </span>
                    )}
                </div>
                <button
                    onClick={onClear}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 hover:bg-slate-700 rounded"
                >
                    Clear
                </button>
            </div>

            {/* Log View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                        <Terminal size={32} className="opacity-20" />
                        <p className="text-xs">Waiting for system logs...</p>
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className={`flex gap-3 px-3 py-2 rounded border ${getColor(log.type)} group transition-all hover:bg-slate-800/50`}>
                            <div className="flex-none pt-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                {getIcon(log.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className={`font-medium ${log.type === 'ERROR' ? 'text-red-400' : 'text-slate-200'}`}>
                                        {log.message}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                {log.details && (
                                    <pre className="mt-2 text-[10px] bg-slate-950 p-2 rounded border border-slate-800 overflow-x-auto text-slate-400">
                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                    </pre>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
};

export default Console;
