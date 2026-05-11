import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PersonData } from '@/types';
import { api } from '@/services/apiClient';
import { triggerHaptic } from '@/utils/haptics';
import { X } from 'lucide-react';
import PremiumButton from './PremiumButton';

interface EditContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: PersonData;
    onSave: (updatedPerson: PersonData) => void;
}

const EditContactModal: React.FC<EditContactModalProps> = ({ isOpen, onClose, person, onSave }) => {
    const [formData, setFormData] = useState<PersonData>(person);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && person) {
            setFormData(person);
            setError(null);
            triggerHaptic('LIGHT');
        }
    }, [isOpen, person]);

    const handleClose = () => {
        triggerHaptic('LIGHT');
        onClose();
    };

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: PersonData) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result: any = await api.updateContact(formData.id, formData);
            if (result.status === 'success') {
                onSave(formData);
                onClose();
            } else {
                setError(result.message || 'Failed to update contact');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" 
                        onClick={handleClose} 
                    />
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800/50 overflow-hidden relative z-10"
                    >
                        {/* Scanline Effect */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

                        <form onSubmit={handleSubmit}>
                            <div className="p-8 border-b border-white/10 dark:border-slate-800/50 flex items-start justify-between relative z-10">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Edit Relationship Profile</h3>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-horizon-500 mt-1">Enterprise Intelligence</p>
                                </div>
                                <button type="button" onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-100 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6 relative z-10">
                                {error && (
                                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-bold text-rose-500 animate-in shake duration-500">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Identity Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-5 py-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-horizon-500/20 focus:border-horizon-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-500"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Digital Anchor (Email)</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email || ''}
                                        onChange={handleChange}
                                        className="w-full px-5 py-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-horizon-500/20 focus:border-horizon-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Affiliation</label>
                                        <input
                                            type="text"
                                            name="organization"
                                            value={formData.organization || ''}
                                            onChange={handleChange}
                                            className="w-full px-5 py-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-horizon-500/20 focus:border-horizon-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Position</label>
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title || ''}
                                            onChange={handleChange}
                                            className="w-full px-5 py-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-slate-800/50 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-horizon-500/20 focus:border-horizon-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-white/10 dark:border-slate-800/50 flex justify-end gap-4 relative z-10">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-6 py-2 text-sm font-black uppercase tracking-widest text-slate-500 hover:text-slate-100 transition-colors"
                                >
                                    Abort
                                </button>
                                <PremiumButton
                                    type="submit"
                                    loading={loading}
                                    className="px-8 py-2 text-sm"
                                >
                                    Commit Changes
                                </PremiumButton>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default EditContactModal;
