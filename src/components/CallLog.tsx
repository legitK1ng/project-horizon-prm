import React, { useState } from 'react';
import { CallRecord } from '@/types';
import { ICONS } from '@/constants';
import { formatDuration, cleanTranscript } from '@/utils/helpers';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

interface CallLogProps {
    calls: CallRecord[];
}

const CallLog: React.FC<CallLogProps> = ({ calls }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const getStatusColor = (status: CallRecord['status']) => {
        switch (status) {
            case 'COMPLETED': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400';
            case 'QUEUED': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
            case 'ERROR': return 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const filteredCalls = calls.filter(call => {
        const contactName = call.contactName || '';
        const transcript = call.transcript || '';
        return contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            transcript.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Call Logs</h2>
                    <p className="text-slate-500 dark:text-slate-400">History of all analyzed conversations.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search calls..."
                        className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                {filteredCalls.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        {ICONS.Logs}
                        <p className="mt-2">No calls found matching your search.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredCalls.map((call) => (
                            <div key={call.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <div
                                    className="p-4 cursor-pointer flex items-center justify-between"
                                    onClick={() => toggleExpand(call.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${getStatusColor(call.status)}`}>
                                            {ICONS.Logs}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-900 dark:text-white">{call.contactName}</h4>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <span>{new Date(call.timestamp).toLocaleString()}</span>
                                                <span>•</span>
                                                <span>{formatDuration(call.duration)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                                            {call.status}
                                        </span>
                                        {expandedId === call.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                    </div>
                                </div>

                                {expandedId === call.id && (
                                    <div className="px-4 pb-4 pl-[4.5rem] animate-in slide-in-from-top-2 duration-200">
                                        {call.executiveBrief && (
                                            <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                                <h5 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                                                    {ICONS.Dashboard} Executive Brief
                                                </h5>
                                                <p className="text-slate-700 dark:text-slate-300 mb-3">{call.executiveBrief.summary}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {call.executiveBrief.tags.map(tag => (
                                                        <span key={tag} className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded border border-slate-200 dark:border-slate-700">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Transcript</h5>
                                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
                                                {cleanTranscript(call.transcript)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallLog;
