import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    X, Mail, Phone, Building, User, Clock, FileText, ChevronRight,
    Shield, Activity, Globe, Linkedin, Twitter, ExternalLink,
    MapPin, Calendar, Hash, Link2, Fingerprint, Sparkles, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CallRecord, Contact } from '@/types';
import { formatDuration, getInitials } from '@/utils/helpers';
import { cn } from '@/utils/ui';
import { triggerHaptic } from '@/utils/haptics';
import EnrichmentCard from './EnrichmentCard';
import OsintSignals from './OsintSignals';
import PremiumButton from './PremiumButton';

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

    const handleClose = useCallback(() => {
        triggerHaptic('LIGHT');
        onClose();
    }, [onClose]);

    const handleTabChange = (tab: Tab) => {
        if (tab !== activeTab) {
            triggerHaptic('LIGHT');
            setActiveTab(tab);
        }
    };

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
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [handleClose]);

    if (!contactName && !contactId) return null;

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview',  label: 'Overview',  icon: <User size={16} /> },
        { id: 'notes',     label: 'Notes',     icon: <FileText size={16} /> },
        { id: 'actions',   label: 'Actions',   icon: <Activity size={16} /> },
        { id: 'osint',     label: 'OSINT',     icon: <Globe size={16} /> },
        { id: 'timeline',  label: 'Timeline',  icon: <Clock size={16} /> },
    ];

    return (
        <AnimatePresence>
            <motion.div 
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100]" 
                onClick={handleClose} 
            />
            <motion.div 
                key="drawer"
                initial={{ x: '100%', opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0.5 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 w-full max-w-xl bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-[101] shadow-2xl border-l border-white/20 dark:border-slate-800/50 flex flex-col"
            >
                {/* Scanline Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-0" />

                {/* Header */}
                <div className="p-8 border-b border-white/10 dark:border-slate-800/50 bg-white/5 dark:bg-slate-900/20 relative overflow-hidden shrink-0">
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
                                    <PremiumButton size="sm" className="h-8 px-3 text-[10px]" onClick={() => handleTabChange('timeline')}>
                                        Interaction History
                                    </PremiumButton>
                                    {allUrls.filter((u: any) => u.value?.includes('linkedin.com')).map((u: any, i: number) => (
                                        <a key={i} href={u.value} target="_blank" rel="noopener noreferrer"
                                            onClick={() => triggerHaptic('LIGHT')}
                                            className="p-1.5 text-blue-500 hover:text-blue-700 bg-white/50 dark:bg-slate-800/50 border border-white/20 dark:border-slate-700/50 rounded-lg hover:border-horizon-500/30 transition-all shadow-sm">
                                            <Linkedin size={14} />
                                        </a>
                                    ))}
                                    {allUrls.filter((u: any) => u.value?.includes('twitter.com') || u.value?.includes('x.com')).map((u: any, i: number) => (
                                        <a key={i} href={u.value} target="_blank" rel="noopener noreferrer"
                                            onClick={() => triggerHaptic('LIGHT')}
                                            className="p-1.5 text-sky-500 hover:text-sky-700 bg-white/50 dark:bg-slate-800/50 border border-white/20 dark:border-slate-700/50 rounded-lg hover:border-horizon-500/30 transition-all shadow-sm">
                                            <Twitter size={14} />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-100 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 hover:border-white/20 shadow-sm backdrop-blur-sm">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-8 border-b border-white/10 dark:border-slate-800/50 bg-white/50 dark:bg-slate-950/50 flex items-center gap-5 overflow-x-auto shrink-0 no-scrollbar">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                            className={cn(
                                "flex items-center gap-2 py-4 text-[10px] font-black tracking-widest uppercase transition-all relative whitespace-nowrap",
                                activeTab === tab.id
                                    ? "text-horizon-500"
                                    : "text-slate-400 hover:text-slate-200"
                            )}>
                            {tab.icon}{tab.label}
                            {activeTab === tab.id && (
                                <motion.div 
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-horizon-500 rounded-full" 
                                />
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
                                            <div key={i} className="flex items-center gap-3 p-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-xl hover:border-horizon-500/20 transition-all group shadow-sm">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-500/20">
                                                    <Phone size={13} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">{p.type || 'Phone'}</p>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{p.value}</p>
                                                </div>
                                                {p.metadata?.primary && <span className="text-[9px] font-black text-horizon-500 uppercase tracking-tighter">Primary</span>}
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
                                            <div key={i} className="flex items-center gap-3 p-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-xl hover:border-horizon-500/20 transition-all group shadow-sm">
                                                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0 border border-blue-500/20">
                                                    <Mail size={13} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">{e.type || 'Email'}</p>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{e.value}</p>
                                                </div>
                                                {e.metadata?.primary && <span className="text-[9px] font-black text-horizon-500 uppercase tracking-tighter">Primary</span>}
                                            </div>
                                        )) : localContact?.email ? (
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0"><Mail size={13} /></div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{localContact.email}</p>
                                            </div>
                                        ) : null}

                                        {/* All organizations */}
                                        {allOrgs.map((o: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-xl hover:border-horizon-500/20 transition-all group shadow-sm">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 border border-indigo-500/20">
                                                    <Building size={13} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">
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
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Activity size={12} className="text-horizon-500" />
                                        Relationship Pulse
                                    </h4>
                                    <div className="bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-3xl p-6 shadow-glow relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Activity size={80} />
                                        </div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Health Score</p>
                                                <p className="text-xs text-slate-500 mt-1">Based on interaction frequency and sentiment.</p>
                                            </div>
                                            <div className={cn("text-4xl font-black tabular-nums", healthColor)}>{healthScore}%</div>
                                        </div>
                                        <div className="mt-4 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${healthScore}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className={cn("h-full", healthScore > 70 ? 'bg-emerald-500' : healthScore > 40 ? 'bg-amber-500' : 'bg-rose-500')} 
                                            />
                                        </div>
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
                                                <div key={call.id} className="p-4 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-2xl flex items-center justify-between group hover:border-horizon-500/30 transition-all shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 border border-white/10">
                                                            <Clock size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                                {new Date(call.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 font-medium truncate max-w-[160px] mt-0.5">
                                                                {call.executive_brief?.summary || 'Call detected'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">{formatDuration(call.duration ?? undefined)}</span>
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
                                        <div key={i} className="flex gap-4 p-5 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-3xl hover:border-horizon-500/30 transition-all group shadow-sm relative overflow-hidden">
                                            <div className="absolute inset-y-0 left-0 w-1 bg-horizon-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="mt-1">
                                                <div className="w-5 h-5 rounded-md border-2 border-slate-200 dark:border-slate-700 group-hover:border-horizon-500 group-hover:bg-horizon-500/10 transition-all flex items-center justify-center" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{item.text}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-2 flex items-center gap-1.5">
                                                    <Clock size={10} className="text-horizon-500" />
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
                                <div className="p-6 bg-gradient-to-br from-horizon-600 to-horizon-800 rounded-3xl text-white shadow-xl shadow-horizon-500/20 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Database size={64} />
                                    </div>
                                    <div className="flex items-center gap-3 mb-3 relative z-10">
                                        <Shield size={20} className="text-horizon-200" />
                                        <h4 className="font-black text-xs tracking-widest uppercase">Intelligence Source: Google</h4>
                                    </div>
                                    <p className="text-xs opacity-90 leading-relaxed font-medium relative z-10">
                                        Verified enterprise-grade data synchronized from Google People Cloud including deep digital footprint signals.
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
                <div className="p-6 border-t border-white/10 dark:border-slate-800/50 bg-white/5 dark:bg-slate-900/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Sparkles size={12} className="text-horizon-500" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Intelligence Grade: Enterprise</p>
                    </div>
                    <div 
                        onClick={() => triggerHaptic('MEDIUM')}
                        className="flex items-center gap-2 text-[10px] font-black text-horizon-500 uppercase tracking-widest cursor-pointer hover:text-horizon-400 transition-colors group"
                    >
                        Export Dossier 
                        <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UnifiedContactDrawer;
