import React from 'react';
import { Contact } from '@/types';
import { X, Phone, Mail, Building, TrendingUp } from 'lucide-react';

interface ContactDetailDrawerProps {
    contact: Contact;
    onClose: () => void;
}

const ContactDetailDrawer: React.FC<ContactDetailDrawerProps> = ({ contact, onClose }) => {
    const getInitials = (name: string) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const avatarColors = [
        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    ];
    const colorIndex = contact.name.charCodeAt(0) % avatarColors.length;

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
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl ${avatarColors[colorIndex]}`}>
                            {getInitials(contact.name)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{contact.name}</h2>
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
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{contact.totalCalls}</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl">
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Last Contact</p>
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                {contact.lastContacted ? new Date(contact.lastContacted).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
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

                            {contact.organization && (
                                <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <Building size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Organization</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{contact.organization}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Relationship Timeline */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Activity</h3>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <TrendingUp size={18} className="text-emerald-500" />
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {contact.totalCalls} interaction{contact.totalCalls !== 1 ? 's' : ''} recorded
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    View in Call Logs for full analysis
                                </p>
                            </div>
                        </div>
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
