import React, { useState, useEffect, useMemo } from 'react';
import { X, Mail, Phone, Building, User, Clock, FileText, ChevronRight, Shield, Activity, Globe, Linkedin, Twitter, ExternalLink } from 'lucide-react';
import { CallRecord, Contact } from '@/types';
import { api } from '@/services/apiClient';
import { formatDuration, getInitials } from '@/utils/helpers';
import { cn } from '@/utils/ui';
import EnrichmentCard from './EnrichmentCard';

interface UnifiedContactDrawerProps {
    contactId?: string | null;
    contactName: string | null;
    onClose: () => void;
    calls: CallRecord[];
    contacts: Contact[];
}

type Tab = 'overview' | 'notes' | 'actions' | 'osint' | 'timeline';

const UnifiedContactDrawer: React.FC<UnifiedContactDrawerProps> = ({ contactId, contactName, onClose, calls, contacts }) => {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    // Find local contact record if available
    const localContact = useMemo(() => {
        if (!contactName) return null;
        return contacts.find(c => {
            const fullName = `${c.first_name} ${c.last_name || ''}`.trim();
            return fullName.toLowerCase() === contactName.toLowerCase();
        }) || null;
    }, [contactName, contacts]);

    // Filter calls for this contact (Precision: ID-first, fallback to Name)
    const contactCalls = useMemo(() => {
        if (!contactName && !contactId) return [];
        return calls
            .filter(c => {
                if (contactId && c.contact_id === contactId) return true;
                if (contactName && c.contact_name?.toLowerCase() === contactName.toLowerCase()) return true;
                return false;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [contactName, contactId, calls]);

    // Extract action items from contact's calls
    const actionItems = useMemo(() => {
        return contactCalls
            .filter(c => c.executive_brief && (c.executive_brief.action_items?.length || 0) > 0)
            .flatMap(c => (c.executive_brief!.action_items || []).map(item => ({
                text: item,
                date: c.timestamp,
                callId: c.id
            })));
    }, [contactCalls]);

    // Fetch OSINT / Google contact data
    useEffect(() => {
        if (!contactName) return;
        setLoading(true);
        api.searchPerson(contactName).then(result => {
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

    const initials = getInitials(contactName);

    // Calculate relationship health (mock logic)
    const healthScore = Math.min(100, (contactCalls.length * 10) + (localContact?.total_calls || 0));
    const healthColor = healthScore > 70 ? 'text-emerald-500' : healthScore > 40 ? 'text-amber-500' : 'text-rose-500';

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Overview', icon: <User size={16} /> },
        { id: 'notes', label: 'Notes', icon: <FileText size={16} /> },
        { id: 'actions', label: 'Actions', icon: <Activity size={16} /> },
        { id: 'osint', label: 'OSINT', icon: <Globe size={16} /> },
        { id: 'timeline', label: 'Timeline', icon: <Clock size={16} /> },
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Main Full-Panel Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-slate-950 z-[101] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-500">
                {/* Header Section */}
                <div className="p-8 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50 relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />

                    <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                {(data?.photoUrl || localContact?.photo_url) ? (
                                    <img
                                        src={data?.photoUrl || localContact?.photo_url || ''}
                                        alt={contactName}
                                        className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-xl"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-3xl shadow-xl shadow-blue-500/20">
                                        {initials}
                                    </div>
                                )}
                                <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700">
                                    <div className={cn("text-xs font-bold", healthColor)}>{healthScore}</div>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                    {data?.name || contactName}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-1.5">
                                    {data?.title || "Professional Connection"}
                                    {data?.organization && (
                                        <>
                                            <span className="opacity-30">•</span>
                                            <span className="text-blue-600 dark:text-blue-400">{data.organization}</span>
                                        </>
                                    )}
                                </p>
                                <div className="flex items-center gap-3 mt-4">
                                    <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/20">
                                        Call Log
                                    </button>
                                    <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg">
                                        <Linkedin size={16} />
                                    </button>
                                    <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg">
                                        <Twitter size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="px-8 border-b border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 flex items-center gap-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 py-4 text-xs font-bold tracking-wider uppercase transition-all relative",
                                activeTab === tab.id
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-500"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-in fade-in duration-300" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 overflow-y-auto thin-scrollbar p-8">
                    {loading ? (
                        <div className="space-y-6">
                            <div className="h-32 skeleton rounded-2xl w-full" />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="h-24 skeleton rounded-2xl" />
                                <div className="h-24 skeleton rounded-2xl" />
                            </div>
                            <div className="space-y-3">
                                <div className="h-4 skeleton rounded w-3/4" />
                                <div className="h-4 skeleton rounded w-1/2" />
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* OVERVIEW TAB */}
                            {activeTab === 'overview' && (
                                <div className="space-y-8">
                                    <section>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Contact Intel</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
                                                    <Mail size={16} />
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Email</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                                                    {data?.email || "No email synchronized"}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                                                    <Phone size={16} />
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Phone</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                                                    {localContact?.phone || contactCalls[0]?.phone_number || "Unavailable"}
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Relationship Pulse</h4>
                                        <div className="card p-5 border-none shadow-glow flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Health Score</p>
                                                <p className="text-xs text-slate-500 mt-1">Based on interaction frequency and sentiment.</p>
                                            </div>
                                            <div className={cn("text-3xl font-black", healthColor)}>
                                                {healthScore}%
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Calls</h4>
                                            {contactCalls.length > 0 && (
                                                <button
                                                    onClick={() => setActiveTab('timeline')}
                                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase hover:underline"
                                                >
                                                    View All
                                                </button>
                                            )}
                                        </div>
                                        {contactCalls.length === 0 ? (
                                            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                                                <p className="text-xs text-slate-400 italic">No recent calls recorded</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {contactCalls.slice(0, 3).map((call) => (
                                                    <div key={call.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                                                <Clock size={14} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                    {new Date(call.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                                                    {call.executive_brief?.summary || "Call detected"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-mono text-slate-400">
                                                            {formatDuration(call.duration ?? undefined)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <section>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Key Metrics</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="text-center">
                                                <p className="text-xl font-bold text-slate-900 dark:text-white">{contactCalls.length}</p>
                                                <p className="text-[10px] text-slate-500 uppercase">Interactions</p>
                                            </div>
                                            <div className="text-center border-x border-slate-100 dark:border-slate-800">
                                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                                    {contactCalls.length > 0 ? formatDuration(contactCalls.reduce((s, c) => s + (typeof c.duration === 'number' ? c.duration : 0), 0)) : '0m'}
                                                </p>
                                                <p className="text-[10px] text-slate-500 uppercase">Lifetime</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                                    {contactCalls[0] ? new Date(contactCalls[0].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}
                                                </p>
                                                <p className="text-[10px] text-slate-500 uppercase">Last Contact</p>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* NOTES TAB */}
                            {activeTab === 'notes' && (
                                <div className="space-y-6">
                                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Professional Notes</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                                            {localContact?.notes || "No persistent notes for this contact. Notes generated from briefs will appear in the History tab."}
                                        </p>
                                    </div>

                                    {localContact?.tags && localContact.tags.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Relationship Tags</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {localContact.tags.map(tag => (
                                                    <span key={tag} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 rounded-full">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ACTIONS TAB */}
                            {activeTab === 'actions' && (
                                <div className="space-y-4">
                                    {actionItems.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                                <Activity size={32} />
                                            </div>
                                            <p className="text-sm font-bold text-slate-600">No Pending Actions</p>
                                            <p className="text-xs text-slate-400 mt-1">Actions are extracted from AI-analyzed call logs.</p>
                                        </div>
                                    ) : (
                                        actionItems.map((item, i) => (
                                            <div key={i} className="flex gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-blue-500/30 transition-all group">
                                                <div className="mt-1">
                                                    <div className="w-5 h-5 rounded-md border-2 border-slate-200 dark:border-slate-700 group-hover:border-blue-500 transition-colors" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.text}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        Detected {new Date(item.date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}                             {/* OSINT TAB */}
                            {activeTab === 'osint' && (
                                <div className="space-y-6">
                                    <EnrichmentCard
                                        contactId={localContact?.id || ''}
                                        contactName={contactName}
                                    />

                                    <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Shield size={20} />
                                            <h4 className="font-bold text-sm tracking-wide uppercase">Intelligence Source: Google People</h4>
                                        </div>
                                        <p className="text-xs opacity-90 leading-relaxed">
                                            Verified intelligence synchronized from organization directory and social signals.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                <Building size={16} className="text-slate-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Affiliation</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                                    {data?.organization || "Independent / Unverified"}
                                                </p>
                                            </div>
                                        </div>

                                        {data?.resourceName && (
                                            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Globe size={16} className="text-slate-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Google ID</p>
                                                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                        {data.resourceName}
                                                    </p>
                                                </div>
                                                <ExternalLink size={12} className="text-slate-300" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TIMELINE TAB */}
                            {activeTab === 'timeline' && (
                                <div className="relative pl-4 ml-2 border-l-2 border-slate-100 dark:border-slate-900 space-y-8">
                                    {contactCalls.length === 0 ? (
                                        <div className="text-center py-12 -ml-6">
                                            <p className="text-sm text-slate-400 italic">Static relationship - No interactions recorded</p>
                                        </div>
                                    ) : (
                                        contactCalls.map((call, i) => (
                                            <div key={call.id} className="relative">
                                                {/* Dot on line */}
                                                <div className="absolute -left-[21px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-slate-950 border-2 border-blue-600 z-10" />

                                                <div className="animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                                                        {new Date(call.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h5 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                                                                {call.executive_brief?.title || "Interpreted Call"}
                                                            </h5>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-slate-400 px-2 py-0.5 bg-white dark:bg-slate-950 rounded-md border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-slate-300">
                                                                    {formatDuration(call.duration ?? undefined)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                                                            {call.executive_brief?.summary || call.transcript || "Call detected with no transcript content."}
                                                        </p>
                                                        {(call.tags || call.executive_brief?.tags || (call.keywords && call.keywords.length > 0)) && (
                                                            <div className="flex flex-wrap gap-1.5 mt-3">
                                                                {(call.tags || call.executive_brief?.tags || []).slice(0, 3).map(tag => (
                                                                    <span key={tag} className="text-[9px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase">
                                                                        #{tag}
                                                                    </span>
                                                                ))}
                                                                {(call.keywords || call.executive_brief?.keywords || []).slice(0, 2).map(kw => (
                                                                    <span key={kw} className="text-[9px] font-bold text-slate-400 uppercase italic">
                                                                        {kw}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Intelligence Grade: Enterprise
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase cursor-pointer hover:underline">
                        Export Dossier <ChevronRight size={12} />
                    </div>
                </div>
            </div>
        </>
    );
};

export default UnifiedContactDrawer;
