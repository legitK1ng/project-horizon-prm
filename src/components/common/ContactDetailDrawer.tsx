import React from 'react';
import { Contact } from '@/types';
import { X, Phone, Mail, Building, Heart, ShieldCheck, MapPin } from 'lucide-react';
import { cn } from '@/utils/ui';
import ProfileAvatar from './ProfileAvatar';
import OsintSignals from './OsintSignals';
import ContactTimeline from './ContactTimeline';

interface ContactDetailDrawerProps {
    contact: Contact;
    onClose: () => void;
}

const ContactDetailDrawer: React.FC<ContactDetailDrawerProps> = ({ contact, onClose }) => {
    const healthScore = contact.health_score ?? 0;
    const rawData = contact.raw_data as any;
    const location = rawData?.addresses?.[0]?.formattedValue;

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" />

            {/* Drawer */}
            <div
                className="relative w-full max-w-lg bg-slate-50/80 dark:bg-slate-900/90 border-l border-white/20 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-500 flex flex-col h-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Fixed Header Section */}
                <div className="relative p-8 pb-10 overflow-hidden flex-shrink-0">
                    {/* Background Accent */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-500 transition-all z-20 shadow-sm border border-white/20"
                    >
                        <X size={18} />
                    </button>

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <ProfileAvatar
                            url={contact.photo_url}
                            name={contact.full_name || `${contact.first_name} ${contact.last_name || ''}`}
                            size="xl"
                            className="mb-6 ring-8 ring-blue-500/5 shadow-2xl shadow-blue-500/20 transition-transform hover:scale-105 duration-500"
                        />

                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
                            {contact.full_name || `${contact.first_name} ${contact.last_name || ''}`}
                        </h2>

                        <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                            {contact.organization && (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-white/50 dark:bg-slate-800/50 rounded-full border border-white/20">
                                    <Building size={14} className="text-blue-500" />
                                    {contact.organization}
                                </span>
                            )}
                            {location && (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-white/50 dark:bg-slate-800/50 rounded-full border border-white/20">
                                    <MapPin size={14} className="text-emerald-500" />
                                    {location}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Scrollable Intelligence Feed */}
                <div className="flex-1 overflow-y-auto px-8 pb-12 space-y-10 custom-scrollbar overscroll-contain">

                    {/* Relationship Health Surface */}
                    <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl p-8 rounded-[2rem] border border-white/40 dark:border-white/5 relative overflow-hidden group shadow-xl shadow-slate-200/50 dark:shadow-none">
                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                    <Heart size={24} className={cn(healthScore > 70 && "fill-white animate-pulse")} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horizon Score</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{healthScore}%</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border shadow-sm",
                                    healthScore < 40 ? "text-red-500 bg-red-50 border-red-100" :
                                        healthScore < 70 ? "text-amber-500 bg-amber-50 border-amber-100" :
                                            "text-emerald-500 bg-emerald-50 border-emerald-100"
                                )}>
                                    {healthScore < 40 ? "Needs Rescue" : healthScore < 70 ? "Stable" : "Elite Status"}
                                </span>
                            </div>
                        </div>

                        {/* Health Gauge */}
                        <div className="relative z-10 h-3 w-full bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden shadow-inner">
                            <div
                                className={cn(
                                    "h-full transition-all duration-1000 ease-out bg-gradient-to-r shadow-[0_0_20px_rgba(59,130,246,0.5)]",
                                    healthScore < 40 ? "from-red-500 to-rose-600" :
                                        healthScore < 70 ? "from-amber-400 to-orange-500" :
                                            "from-emerald-400 to-blue-500"
                                )}
                                style={{ width: `${healthScore}%` }}
                            />
                        </div>
                    </div>

                    {/* Bio / Insights Section */}
                    {contact.notes && (
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contextual Insights</h3>
                            <div className="p-6 bg-slate-900 dark:bg-black text-slate-300 rounded-[2rem] text-sm leading-relaxed font-medium shadow-2xl relative overflow-hidden">
                                {/* Glowing Accent */}
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
                                <p className="indent-4">{contact.notes}</p>
                            </div>
                        </div>
                    )}

                    {/* OSINT Signals Component */}
                    <OsintSignals contact={contact} />

                    {/* Core Connectivity */}
                    <div className="grid grid-cols-2 gap-4">
                        <a
                            href={`tel:${contact.phone}`}
                            className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 hover:border-blue-500 transition-all group"
                        >
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <Phone size={20} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Call Now</span>
                        </a>
                        <a
                            href={`mailto:${contact.email}`}
                            className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 hover:border-purple-500 transition-all group"
                        >
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-2xl text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <Mail size={20} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Send Email</span>
                        </a>
                    </div>

                    {/* Interaction Timeline Component */}
                    <ContactTimeline contactId={contact.id} />

                    {/* Security Footer */}
                    <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                        <ShieldCheck size={12} />
                        End-to-End Relationship Encryption
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactDetailDrawer;
