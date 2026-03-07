import React, { useState, useEffect, useMemo } from 'react';
import { X, Mail, Phone, Building, User, Clock, FileText, ChevronRight } from 'lucide-react';
import { searchPerson } from '@/services/apiService';
import { PersonData, CallRecord } from '@/types';
import { formatDuration } from '@/utils/helpers';

interface ContactDrawerProps {
    contactName: string | null;
    onClose: () => void;
    calls: CallRecord[];
}

type Tab = 'details' | 'history' | 'briefs';

const ContactDrawer: React.FC<ContactDrawerProps> = ({ contactName, onClose, calls }) => {
    const [data, setData] = useState<PersonData | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('details');

    // Filter calls for this contact
    const contactCalls = useMemo(() => {
        if (!contactName) return [];
        return calls
            .filter(c => c.contactName?.toLowerCase() === contactName.toLowerCase())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [contactName, calls]);

    // Extract briefs from contact's calls
    const briefs = useMemo(() => {
        return contactCalls
            .filter(c => c.executiveBrief)
            .map(c => ({
                callId: c.id,
                date: c.timestamp,
                title: c.executiveBrief!.title,
                summary: c.executiveBrief!.summary,
                tags: c.executiveBrief!.tags,
            }));
    }, [contactCalls]);

    // Fetch Google contact data
    useEffect(() => {
        if (!contactName) return;
        setLoading(true);
        setData(null);
        setActiveTab('details');

        searchPerson(contactName).then(result => {
            setData(result);
        }).catch(err => {
            console.error('Contact fetch error:', err);
        }).finally(() => {
            setLoading(false);
        });
    }, [contactName]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!contactName) return null;

    const initials = contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const totalDuration = contactCalls.reduce((sum, c) => {
        const dur = typeof c.duration === 'number' ? c.duration : parseInt(String(c.duration)) || 0;
        return sum + dur;
    }, 0);

    const tabs: { id: Tab; label: string; count?: number }[] = [
        { id: 'details', label: 'Details' },
        { id: 'history', label: 'History', count: contactCalls.length },
        { id: 'briefs', label: 'Briefs', count: briefs.length },
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-96 max-w-full bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                            {data?.photoUrl ? (
                                <img
                                    src={data.photoUrl}
                                    alt={contactName}
                                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                                    {initials}
                                </div>
                            )}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {data?.name || contactName}
                                </h3>
                                {(data?.title || data?.organization) && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {data?.title}{data?.title && data?.organization && ' at '}{data?.organization}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{contactCalls.length}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Calls</p>
                        </div>
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{briefs.length}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Briefs</p>
                        </div>
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{formatDuration(totalDuration)}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === tab.id
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="ml-1 text-[10px] opacity-60">({tab.count})</span>
                            )}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto thin-scrollbar p-6">
                    {loading ? (
                        <div className="space-y-4">
                            <div className="h-4 skeleton w-3/4 rounded" />
                            <div className="h-4 skeleton w-1/2 rounded" />
                            <div className="h-4 skeleton w-2/3 rounded" />
                            <div className="h-4 skeleton w-1/3 rounded" />
                        </div>
                    ) : (
                        <>
                            {/* DETAILS TAB */}
                            {activeTab === 'details' && (
                                <div className="space-y-4">
                                    {data?.email && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                                            <Mail size={16} className="text-slate-400 shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Email</p>
                                                <a href={`mailto:${data.email}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                                    {data.email}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {contactCalls[0]?.phoneNumber && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                                            <Phone size={16} className="text-slate-400 shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Phone</p>
                                                <p className="text-sm text-slate-800 dark:text-slate-200">{contactCalls[0].phoneNumber}</p>
                                            </div>
                                        </div>
                                    )}
                                    {data?.organization && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                                            <Building size={16} className="text-slate-400 shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Company</p>
                                                <p className="text-sm text-slate-800 dark:text-slate-200">{data.organization}</p>
                                            </div>
                                        </div>
                                    )}
                                    {data?.title && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                                            <User size={16} className="text-slate-400 shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Title</p>
                                                <p className="text-sm text-slate-800 dark:text-slate-200">{data.title}</p>
                                            </div>
                                        </div>
                                    )}
                                    {!data?.found && !loading && (
                                        <div className="text-center py-8 text-slate-400">
                                            <User size={32} className="mx-auto mb-2 opacity-40" />
                                            <p className="text-sm">No detailed profile found in Google Contacts</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* HISTORY TAB */}
                            {activeTab === 'history' && (
                                <div className="space-y-2">
                                    {contactCalls.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <Clock size={32} className="mx-auto mb-2 opacity-40" />
                                            <p className="text-sm">No call history</p>
                                        </div>
                                    ) : (
                                        contactCalls.map(call => (
                                            <div key={call.id} className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        {new Date(call.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-xs text-slate-400">{formatDuration(call.duration)}</span>
                                                </div>
                                                {call.executiveBrief && (
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate">
                                                        {call.executiveBrief.title}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${call.status === 'COMPLETED' ? 'bg-emerald-500' :
                                                            call.status === 'ERROR' ? 'bg-rose-500' : 'bg-amber-500'
                                                        }`} />
                                                    <span className="text-[10px] text-slate-400 uppercase">{call.status}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* BRIEFS TAB */}
                            {activeTab === 'briefs' && (
                                <div className="space-y-3">
                                    {briefs.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <FileText size={32} className="mx-auto mb-2 opacity-40" />
                                            <p className="text-sm">No executive briefs yet</p>
                                        </div>
                                    ) : (
                                        briefs.map((brief, i) => (
                                            <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(brief.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <ChevronRight size={14} className="text-slate-300" />
                                                </div>
                                                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                                    {brief.title}
                                                </h5>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                                    {brief.summary}
                                                </p>
                                                {brief.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {brief.tags.slice(0, 3).map(tag => (
                                                            <span key={tag} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 text-[10px] text-slate-500 rounded border border-slate-200 dark:border-slate-700">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default ContactDrawer;
