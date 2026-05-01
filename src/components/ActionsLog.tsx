import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useCalls } from '@/hooks/useHorizonData';
import { ICONS } from '@/constants';
import { Calendar, CheckSquare, Copy, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { cn } from '@/lib/utils';

const ActionsLog: React.FC = () => {
    const { data: calls = [], isLoading } = useCalls();
    const { toast } = useToast();
    const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

    // Filter calls that have action items
    const actionableCalls = calls
        .filter(call => {
            const items = call.executive_brief?.action_items;
            return Array.isArray(items) && items.length > 0;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalItems = actionableCalls.reduce(
        (sum, call) => {
            const items = call.executive_brief?.action_items;
            return sum + (Array.isArray(items) ? items.length : 0);
        },
        0
    );

    const toggleExpand = (id: string) => {
        setExpandedCallId(expandedCallId === id ? null : id);
    };

    const addToCalendar = (text: string, date: string) => {
        const title = encodeURIComponent(`Action: ${text}`);
        const details = encodeURIComponent(`From Call on ${new Date(date).toLocaleString()}`);
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
        window.open(url, '_blank');
        toast('Added to Google Calendar');
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast('Copied to clipboard');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Actions Log</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage action items and tasks extracted from your calls.</p>
                </div>
                {actionableCalls.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <ClipboardList size={16} />
                        <span><strong className="text-slate-700 dark:text-slate-200">{totalItems}</strong> items across <strong className="text-slate-700 dark:text-slate-200">{actionableCalls.length}</strong> calls</span>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center p-20">
                        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                    </div>
                ) : actionableCalls.length === 0 ? (
                    <motion.div
                      className={cn(
                        "p-16 text-center",
                        "glass card backdrop-blur-xl",
                        "bg-white/70 dark:bg-slate-900/70",
                        "border border-slate-200/50 dark:border-slate-700/50",
                        "rounded-3xl"
                      )}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                    >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 mb-4">
                            <ClipboardList size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No action items yet</h3>
                        <p className="text-slate-400 text-sm max-w-sm mx-auto">
                            Process calls in the Processing Lab to extract actionable items automatically.
                        </p>
                    </motion.div>
                ) : (
                    actionableCalls.map((call) => (
                        <motion.div
                          key={call.id}
                          className={cn(
                            "overflow-hidden",
                            "glass card backdrop-blur-xl",
                            "bg-white/70 dark:bg-slate-900/70",
                            "border border-slate-200/50 dark:border-slate-700/50",
                            "rounded-2xl"
                          )}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                          whileHover={{ scale: 1.02 }}
                        >
                            <div
                                onClick={() => toggleExpand(call.id)}
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                                        {ICONS.Action}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            {call.executive_brief?.title || 'Untitled Brief'}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="font-medium">{call.contact_name}</span>
                                            <span>•</span>
                                            <span>{new Date(call.timestamp).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className="text-purple-600 dark:text-purple-400 font-medium">
                                                {(call.executive_brief?.action_items as string[]).length} Items
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {expandedCallId === call.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                            </div>

                            {expandedCallId === call.id && (
                                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                    {(call.executive_brief?.action_items as string[]).map((item: string, idx: number) => (
                                        <motion.div
                                          key={idx}
                                          className={cn(
                                            "flex items-start gap-3 p-3",
                                            "glass card backdrop-blur-md",
                                            "bg-white/60 dark:bg-slate-800/60",
                                            "border border-slate-100/50 dark:border-slate-700/50",
                                            "rounded-lg group hover:scale-[1.01] transition-all"
                                          )}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                                        >
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
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ActionsLog;
