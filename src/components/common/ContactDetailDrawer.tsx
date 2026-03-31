import React from 'react';
import { Contact } from '@/types';
import { X, Phone, Mail, Building, TrendingUp, Heart, ShieldCheck } from 'lucide-react';
import { useHealth } from '@/hooks/useHorizonData';
import { cn } from '@/utils/ui';

interface ContactDetailDrawerProps {
    contact: Contact;
    onClose: () => void;
}

const ContactDetailDrawer: React.FC<ContactDetailDrawerProps> = ({ contact, onClose }) => {
    const { data: healthData } = useHealth(contact.id);
    const healthScore = healthData?.health_score ?? contact.health_score ?? 0;

    const getInitials = (contact: Contact) => {
        const first = contact.first_name?.[0] || contact.name?.[0] || '?';
        const last = contact.last_name?.[0] || '';
        return (first + last).toUpperCase();
    };

    const avatarColors = [
        'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
        'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    ];

    const colorIndex = contact.first_name ? contact.first_name.length % avatarColors.length : 0;

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" />

            {/* Drawer */}
            <div
                className="relative w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors z-10"
                >
                    <X size={18} />
                </button>

                {/* Profile Header */}
                <div className="p-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4 mb-6">
                        {contact.photo_url ? (
                            <img 
                                src={contact.photo_url} 
                                alt={`${contact.first_name} ${contact.last_name || ''}`}
                                className="w-16 h-16 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                                onError={(e) => {
                                    // If image fails to load, fallback to initials by removing the img element
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    if (target.parentElement) {
                                        target.parentElement.classList.remove('p-0');
                                    }
                                }}
                            />
                        ) : (
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl ${avatarColors[colorIndex]}`}>
                                {getInitials(contact)}
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {contact.first_name} {contact.last_name || ''}
                            </h2>
                            {contact.organization && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                                    <Building size={14} />
                                    {contact.organization}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Total Calls</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{contact.total_calls}</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl">
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Last Contact</p>
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                {contact.last_contact_at ? new Date(contact.last_contact_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contact Details */}
                <div className="p-8 space-y-6">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Contact Information</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <Phone size={16} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Phone</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{contact.phone || 'Not available'}</p>
                                </div>
                            </div>

                            {contact.email && (
                                <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                        <Mail size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Email</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{contact.email}</p>
                                    </div>
                                </div>
                            )}

                            {contact.birthdate && (
                                <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div className="w-9 h-9 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                        <Heart size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Birthday</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                            {new Date(contact.birthdate).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Relationship Health Section */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Relationship Pulse</h3>
                        <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                            {/* Decorative Background Icon */}
                            <TrendingUp className="absolute -bottom-4 -right-4 w-24 h-24 text-blue-500/5 dark:text-blue-500/10 -rotate-12 transition-transform group-hover:scale-110" />

                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                                        <Heart size={20} className={cn(healthScore > 70 && "fill-blue-600 animate-pulse")} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Score</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{healthScore}%</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md",
                                        healthScore < 40 ? "text-red-500 bg-red-500/10" : 
                                        healthScore < 70 ? "text-amber-500 bg-amber-500/10" : 
                                        "text-emerald-500 bg-emerald-500/10"
                                    )}>
                                        {healthScore < 40 ? "Critical Decay" : healthScore < 70 ? "Needs Warmth" : "Peak Connection"}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">Auto-calculated daily</p>
                                </div>
                            </div>

                            {/* Health Gauge */}
                            <div className="relative z-10 mt-6 h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className={cn(
                                        "h-full transition-all duration-700 ease-out",
                                        healthScore < 40 ? "bg-red-500" : healthScore < 70 ? "bg-amber-500" : "bg-emerald-500"
                                    )}
                                    style={{ width: `${healthScore}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Security Badge (Transcripts) */}
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/30 p-2 px-3 rounded-lg w-fit">
                        <ShieldCheck size={14} />
                        Field-Level Encryption Active
                    </div>

                    {/* Tags */}
                    {contact.tags && contact.tags.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {contact.tags.map((tag) => (
                                    <span key={tag} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-medium">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {contact.notes && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Notes</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                {contact.notes}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactDetailDrawer;
