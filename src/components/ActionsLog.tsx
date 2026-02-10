import React, { useState } from 'react';
import { useData } from '@/hooks/useData';
import { ICONS } from '@/constants';
import { Calendar, CheckSquare, Copy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const ActionsLog: React.FC = () => {
    const { calls } = useData();
    const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

    // Filter calls that have action items
    const actionableCalls = calls
        .filter(call => call.executiveBrief?.actionItems && call.executiveBrief.actionItems.length > 0)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const toggleExpand = (id: string) => {
        setExpandedCallId(expandedCallId === id ? null : id);
    };

    const addToCalendar = (text: string, date: string) => {
        const title = encodeURIComponent(`Action: ${text}`);
        const details = encodeURIComponent(`From Call on ${new Date(date).toLocaleString()}`);
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
        window.open(url, '_blank');
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could fetch/toast here
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Actions Log</h2>
                <p className="text-slate-500 dark:text-slate-400">Manage action items and tasks extracted from your calls.</p>
            </div>

            <div className="space-y-4">
                {actionableCalls.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        {ICONS.Actions}
                        <p className="mt-2">No actionable items found.</p>
                    </div>
                ) : (
                    actionableCalls.map((call) => (
                        <div key={call.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div
                                onClick={() => toggleExpand(call.id)}
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
                                        {ICONS.Action}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            {call.executiveBrief?.title || 'Untitled Brief'}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="font-medium">{call.contactName}</span>
                                            <span>•</span>
                                            <span>{new Date(call.timestamp).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className="text-purple-600 dark:text-purple-400 font-medium">
                                                {call.executiveBrief?.actionItems.length} Items
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {expandedCallId === call.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                            </div>

                            {expandedCallId === call.id && (
                                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3 animation-in slide-in-from-top-2 duration-200">
                                    {call.executiveBrief?.actionItems.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 group hover:shadow-sm transition-shadow">
                                            <CheckSquare className="mt-0.5 text-slate-400" size={18} />
                                            <div className="flex-1">
                                                <p className="text-slate-800 dark:text-slate-200">{item}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => addToCalendar(item, call.timestamp)}
                                                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                                    title="Add to Google Calendar"
                                                >
                                                    <Calendar size={16} />
                                                </button>
                                                <button
                                                    onClick={() => copyToClipboard(item)}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                                                    title="Copy to Clipboard"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ActionsLog;
