import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Mail, Phone, Building, User, Clock, FileText, ChevronRight,
    Shield, Activity, Globe, Linkedin, Twitter, ExternalLink,
    MapPin, Calendar, Hash, Link2, Fingerprint
} from 'lucide-react';
import { CallRecord, Contact } from '@/types';
import { formatDuration, getInitials } from '@/utils/helpers';
import { cn } from '@/utils/ui';
import EnrichmentCard from './EnrichmentCard';
import OsintSignals from './OsintSignals';

interface UnifiedContactDrawerProps {
    contactId?: string | null;
    contactName: string | null;
    onClose: () => void;
    calls: CallRecord[];
    contacts: Contact[];
}

type Tab = 'overview' | 'notes' | 'actions' | 'osint' | 'timeline';


const UnifiedContactDrawer: React.FC<UnifiedContactDrawerProps> = ({
    contactId, contactName, onClose, calls, contacts
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const localContact = useMemo(() => {
        if (contactId) return contacts.find(c => c.id === contactId) || null;
        if (!contactName) return null;
        return contacts.find(c => {
            const full = `${c.first_name} ${c.last_name || ''}`.trim();
            return full.toLowerCase() === contactName.toLowerCase();
        }) || null;
    }, [contactId, contactName, contacts]);

    // ── Parse raw_data (full Google Person object) ───────────────────────────
    const rd = useMemo(() => (localContact?.raw_data as any) || {}, [localContact]);
    const allPhones   = useMemo(() => (rd.phoneNumbers   || []) as any[], [rd]);
    const allEmails   = useMemo(() => (rd.emailAddresses || []) as any[], [rd]);
    const allAddresses= useMemo(() => (rd.addresses      || []) as any[], [rd]);
    const allOrgs     = useMemo(() => (rd.organizations  || []) as any[], [rd]);
    const allUrls     = useMemo(() => (rd.urls           || []) as any[], [rd]);
    const biographies = useMemo(() => (rd.biographies    || []) as any[], [rd]);
    const birthdays   = useMemo(() => (rd.birthdays      || []) as any[], [rd]);
    const userDefined = useMemo(() => (rd.userDefined    || []) as any[], [rd]);
    const photos      = useMemo(() => (rd.photos         || []) as any[], [rd]);

    const primaryOrg   = allOrgs.find(o => o?.metadata?.primary) || allOrgs[0];
    const jobTitle     = primaryOrg?.title || '';
    const department   = primaryOrg?.department || '';
    const photoUrl     = localContact?.photo_url || photos[0]?.url || '';
    const displayName  = localContact?.full_name
        || `${localContact?.first_name || ''} ${localContact?.last_name || ''}`.trim()
        || contactName || '';

    const birthdate = useMemo(() => {
        if (localContact?.birthdate) return localContact.birthdate;
        const bd = birthdays[0]?.date;
        if (!bd) return null;
        const { year, month, day } = bd;
        if (month && day) return `${year || '????'}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        return null;
    }, [localContact, birthdays]);

    // ── Call data ─────────────────────────────────────────────────────────────
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

    const actionItems = useMemo(() => contactCalls
        .filter(c => c.executive_brief?.action_items?.length)
        .flatMap(c => (c.executive_brief!.action_items || []).map(text => ({
            text, date: c.timestamp, callId: c.id
        }))), [contactCalls]);

    const healthScore = Math.min(100, (contactCalls.length * 10) + (localContact?.total_calls || 0));
    const healthColor = healthScore > 70 ? 'text-emerald-500' : healthScore > 40 ? 'text-amber-500' : 'text-rose-500';

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    if (!contactName && !contactId) return null;

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview',  label: 'Overview',  icon: <User size={16} /> },
        { id: 'notes',     label: 'Notes',     icon: <FileText size={16} /> },
        { id: 'actions',   label: 'Actions',   icon: <Activity size={16} /> },
        { id: 'osint',     label: 'OSINT',     icon: <Globe size={16} /> },
        { id: 'timeline',  label: 'Timeline',  icon: <Clock size={16} /> },
    ];

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-slate-950 z-[101] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-500">

                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                    <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                {photoUrl ? (
                                    <img src={photoUrl} alt={displayName} referrerPolicy="no-referrer"
                                        className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-xl" />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-3xl shadow-xl shadow-blue-500/20">
                                        {getInitials(displayName)}
                                    </div>
                                )}
                                <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700">
                                    <div className={cn("text-xs font-bold", healthColor)}>{healthScore}</div>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                    {displayName}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                                    {jobTitle || 'Contact'}
                                    {(localContact?.organization || primaryOrg?.name) && (
                                        <>
                                            <span className="opacity-30">•</span>
                                            <span className="text-blue-600 dark:text-blue-400">
                                                {localContact?.organization || primaryOrg?.name}
                                            </span>
                                        </>
                                    )}
                                    {department && (
                                        <>
                                            <span className="opacity-30">•</span>
                                            <span className="text-slate-400 text-xs">{department}</span>
                                        </>
                                    )}
                                </p>
                                {/* Quick-link icons for known profile URLs */}
                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/20">
                                        Call Log
                                    </button>
                                    {allUrls.filter((u: any) => u.value?.includes('linkedin.com')).map((u: any, i: number) => (
                                        <a key={i} href={u.value} target="_blank" rel="noopener noreferrer"
                                            className="p-1.5 text-blue-500 hover:text-blue-700 border border-slate-200 dark:border-slate-800 rounded-lg">
                                            <Linkedin size={16} />
                                        </a>
                                    ))}
                                    {allUrls.filter((u: any) => u.value?.includes('twitter.com') || u.value?.includes('x.com')).map((u: any, i: number) => (
                                        <a key={i} href={u.value} target="_blank" rel="noopener noreferrer"
                                            className="p-1.5 text-sky-500 hover:text-sky-700 border border-slate-200 dark:border-slate-800 rounded-lg">
                                            <Twitter size={16} />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-8 border-b border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 flex items-center gap-5 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 py-4 text-xs font-bold tracking-wider uppercase transition-all relative whitespace-nowrap",
                                activeTab === tab.id
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-500"
                            )}>
                            {tab.icon}{tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-in fade-in duration-300" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto thin-scrollbar p-8">
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                        {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
                        {activeTab === 'overview' && (
                            <div className="space-y-8">
                                {/* All phones */}
                                <section>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact Intel</h4>
                                    <div className="space-y-2">
                                        {allPhones.length > 0 ? allPhones.map((p: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                                    <Phone size={13} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{p.type || 'Phone'}</p>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{p.value}</p>
                                                </div>
                                                {p.metadata?.primary && <span className="text-[9px] font-black text-blue-500 uppercase">Primary</span>}
                                            </div>
                                        )) : (
                                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <p className="text-xs text-slate-400 italic">
                                                    {localContact?.phone || 'No phone synchronized'}
                                                </p>
                                            </div>
                                        )}

                                        {/* All emails */}
                                        {allEmails.length > 0 ? allEmails.map((e: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                                    <Mail size={13} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{e.type || 'Email'}</p>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{e.value}</p>
                                                </div>
                                                {e.metadata?.primary && <span className="text-[9px] font-black text-blue-500 uppercase">Primary</span>}
                                            </div>
                                        )) : localContact?.email ? (
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0"><Mail size={13} /></div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{localContact.email}</p>
                                            </div>
                                        ) : null}

                                        {/* All organizations */}
                                        {allOrgs.map((o: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                                    <Building size={13} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                                        {o.title ? `${o.title}${o.department ? ` · ${o.department}` : ''}` : 'Organization'}
                                                    </p>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{o.name}</p>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Addresses */}
                                        {allAddresses.map((a: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                                                    <MapPin size={13} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{a.type || 'Address'}</p>
                                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">{a.formattedValue || a.streetAddress}</p>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Birthday */}
                                        {birthdate && (
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                                    <Calendar size={13} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Birthday</p>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{birthdate}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* User-defined custom fields */}
                                        {userDefined.map((f: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                                                    <Hash size={13} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{f.key}</p>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{f.value}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Relationship Pulse */}
                                <section>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Relationship Pulse</h4>
                                    <div className="card p-5 border-none shadow-glow flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Health Score</p>
                                            <p className="text-xs text-slate-500 mt-1">Based on interaction frequency and sentiment.</p>
                                        </div>
                                        <div className={cn("text-3xl font-black", healthColor)}>{healthScore}%</div>
                                    </div>
                                </section>

                                {/* Key Metrics */}
                                <section>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Key Metrics</h4>
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

                                {/* Recent Calls */}
                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Calls</h4>
                                        {contactCalls.length > 0 && (
                                            <button onClick={() => setActiveTab('timeline')} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase hover:underline">
                                                View All
                                            </button>
                                        )}
                                    </div>
                                    {contactCalls.length === 0 ? (
                                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                                            <p className="text-xs text-slate-400 italic">No calls recorded</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {contactCalls.slice(0, 3).map(call => (
                                                <div key={call.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                                            <Clock size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                {new Date(call.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                                                {call.executive_brief?.summary || 'Call detected'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-slate-400">{formatDuration(call.duration ?? undefined)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* ── NOTES TAB ─────────────────────────────────────────── */}
                        {activeTab === 'notes' && (
                            <div className="space-y-6">
                                {biographies.map((bio: any, i: number) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                            {bio.contentType === 'TEXT_HTML' ? 'Bio (HTML)' : 'Biography'}
                                        </h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                                            {bio.value}
                                        </p>
                                    </div>
                                ))}
                                {localContact?.notes && (
                                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Internal Notes</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{localContact.notes}</p>
                                    </div>
                                )}
                                {!biographies.length && !localContact?.notes && (
                                    <div className="p-8 text-center text-slate-400 italic text-sm">No notes or biography recorded.</div>
                                )}
                                {localContact?.tags && localContact.tags.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tags</h4>
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

                        {/* ── ACTIONS TAB ───────────────────────────────────────── */}
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
                        )}

                        {/* ── OSINT TAB ─────────────────────────────────────────── */}
                        {activeTab === 'osint' && (
                            <div className="space-y-6">
                                <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Shield size={20} />
                                        <h4 className="font-bold text-sm tracking-wide uppercase">Intelligence Source: Google People</h4>
                                    </div>
                                    <p className="text-xs opacity-90 leading-relaxed">
                                        Verified data from Google Contacts including all digital footprint signals.
                                    </p>
                                </div>

                                {/* Google Photos */}
                                {photos.length > 1 && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Profile Photos</h4>
                                        <div className="flex gap-3 flex-wrap">
                                            {photos.map((p: any, i: number) => (
                                                <img key={i} src={p.url} alt="" referrerPolicy="no-referrer"
                                                    className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm" />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* All profile URLs */}
                                {allUrls.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Profile Links</h4>
                                        <div className="space-y-2">
                                            {allUrls.map((u: any, i: number) => (
                                                <a key={i} href={u.value} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                                                            {u.value?.includes('linkedin.com') ? <Linkedin size={14} /> :
                                                             u.value?.includes('twitter.com') || u.value?.includes('x.com') ? <Twitter size={14} /> :
                                                             <Link2 size={14} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{u.type || 'Profile'}</p>
                                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[240px]">{u.value}</p>
                                                        </div>
                                                    </div>
                                                    <ExternalLink size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* OSINT Dorking signals */}
                                {localContact && <OsintSignals contact={localContact} />}

                                {/* Google Resource Name */}
                                {localContact?.google_resource_name && (
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <Fingerprint size={16} className="text-slate-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Google Resource ID</p>
                                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                {localContact.google_resource_name}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <EnrichmentCard contactId={localContact?.id || ''} contactName={contactName || ''} />
                            </div>
                        )}

                        {/* ── TIMELINE TAB ──────────────────────────────────────── */}
                        {activeTab === 'timeline' && (
                            <div className="relative pl-4 ml-2 border-l-2 border-slate-100 dark:border-slate-900 space-y-8">
                                {contactCalls.length === 0 ? (
                                    <div className="text-center py-12 -ml-6">
                                        <p className="text-sm text-slate-400 italic">No interactions recorded</p>
                                    </div>
                                ) : (
                                    contactCalls.map((call, i) => (
                                        <div key={call.id} className="relative">
                                            <div className="absolute -left-[21px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-slate-950 border-2 border-blue-600 z-10" />
                                            <div className="animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                                                    {new Date(call.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h5 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                                                            {call.executive_brief?.title || 'Interpreted Call'}
                                                        </h5>
                                                        <span className="text-[10px] text-slate-400 px-2 py-0.5 bg-white dark:bg-slate-950 rounded-md border border-slate-100 dark:border-slate-800 shadow-sm">
                                                            {formatDuration(call.duration ?? undefined)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                                                        {call.executive_brief?.summary || call.transcript || 'Call detected with no transcript content.'}
                                                    </p>
                                                    {((call.tags || call.executive_brief?.tags || []).length > 0 || (call.keywords || []).length > 0) && (
                                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                                            {(call.tags || call.executive_brief?.tags || []).slice(0, 3).map(tag => (
                                                                <span key={tag} className="text-[9px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase">#{tag}</span>
                                                            ))}
                                                            {(call.keywords || call.executive_brief?.keywords || []).slice(0, 2).map(kw => (
                                                                <span key={kw} className="text-[9px] font-bold text-slate-400 uppercase italic">{kw}</span>
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
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intelligence Grade: Enterprise</p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase cursor-pointer hover:underline">
                        Export Dossier <ChevronRight size={12} />
                    </div>
                </div>
            </div>
        </>
    );
};

export default UnifiedContactDrawer;
