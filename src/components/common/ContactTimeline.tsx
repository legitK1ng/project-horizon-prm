import React from 'react';
import { useCalls } from '@/hooks/useHorizonData';
import { MessageSquare, Clock, Calendar } from 'lucide-react';
import { cn } from '@/utils/ui';

interface ContactTimelineProps {
    contactId: string;
    className?: string;
}

const ContactTimeline: React.FC<ContactTimelineProps> = ({ contactId, className }) => {
    const { data: calls, isLoading } = useCalls();

    const contactCalls = React.useMemo(() => {
        return (calls || [])
            .filter(call => call.contact_id === contactId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [calls, contactId]);

    if (isLoading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[1, 2].map(i => (
                    <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (contactCalls.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-800/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-3 shadow-sm">
                    <MessageSquare className="text-slate-300" size={20} />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No touchpoints yet</p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Interaction Timeline</h3>

            <div className="space-y-3 relative">
                {/* Connection Line */}
                <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-800" />

                {contactCalls.map((call) => (
                    <div key={call.id} className="relative pl-12 group">
                        {/* Timeline Node */}
                        <div className="absolute left-4 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 bg-slate-400 group-first:bg-blue-500 z-10" />

                        <div className="p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-100 dark:border-slate-800 rounded-2xl transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                    <Calendar size={10} />
                                    {new Date(call.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 uppercase">
                                    <Clock size={10} />
                                    {call.duration || '00:00'}
                                </div>
                            </div>

                            <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                                {call.executive_brief?.summary || 'New interaction logged'}
                            </p>

                            {call.executive_brief?.key_points && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {call.executive_brief.key_points.slice(0, 2).map((point: string, pIdx: number) => (
                                        <span key={pIdx} className="px-2 py-0.5 bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[9px] font-bold uppercase tracking-wider">
                                            {point}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContactTimeline;
