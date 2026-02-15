import React, { useEffect, useState } from 'react';
import { connectionLogger, LogEntry } from '@/utils/connectionLogger';
import { Wifi, WifiOff, RefreshCw, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';

const ConnectionDebugLog: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        return connectionLogger.subscribe(setLogs);
    }, []);

    const toggleOpen = () => setIsOpen(!isOpen);

    const getIcon = (type: LogEntry['type']) => {
        switch (type) {
            case 'success': return <CheckCircle size={16} className="text-green-500" />;
            case 'error': return <XCircle size={16} className="text-red-500" />;
            case 'warning': return <AlertTriangle size={16} className="text-yellow-500" />;
            default: return <RefreshCw size={16} className="text-blue-500" />;
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
            {/* Toggle Button */}
            <button
                onClick={toggleOpen}
                className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-colors ${isOpen
                    ? 'bg-slate-800 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
            >
                {logs.length > 0 && logs[0]?.details?.error ? (
                    <WifiOff size={18} className="text-red-500" />
                ) : (
                    <Wifi size={18} className={logs.length > 0 ? "text-green-500" : "text-slate-400"} />
                )}
                <span className="text-sm font-medium">Connection Log</span>
                {logs.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 rounded-full">
                        {logs.length}
                    </span>
                )}
            </button>

            {/* Log Window */}
            {isOpen && (
                <div className="mt-2 w-96 max-h-[500px] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
                    <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Request History</h3>
                        <button
                            onClick={() => connectionLogger.clear()}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Clear API Logs
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[400px]">
                        {logs.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs">
                                No activity recorded yet.
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            {getIcon(log.type)}
                                            <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                                                {log.method}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {log.timestamp}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-800 dark:text-slate-200 break-words mb-1">
                                        {log.message}
                                        {log.details?.error && (
                                            <span className="block text-red-500 mt-1 font-mono text-[10px]">
                                                {log.details.error}
                                            </span>
                                        )}
                                    </p>
                                    <div className="text-[10px] text-slate-400 font-mono truncate" title={log.url}>
                                        {log.url.split('?')[0]}...
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConnectionDebugLog;
