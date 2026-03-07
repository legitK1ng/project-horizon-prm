import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { PersonData } from '@/types';
import { updatePerson } from '@/services/apiService';

interface EditContactModalProps {
    person: PersonData;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedPerson: PersonData) => void;
}

const EditContactModal: React.FC<EditContactModalProps> = ({ person, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<PersonData>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && person) {
            setFormData({
                name: person.name || '',
                email: person.email || '',
                organization: person.organization || '',
                title: person.title || '',
                resourceName: person.resourceName,
                etag: person.etag
            });
            setError(null);
        }
    }, [isOpen, person]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await updatePerson(formData);

            if (result.status === 'success' && result.person) {
                // Merge updated fields back into original structure for immediate UI update
                const updated: PersonData = {
                    ...person,
                    ...formData,
                    etag: result.person.etag, // Update etag for future edits
                    found: true
                };
                onSave(updated);
                onClose();
            } else {
                throw new Error(result.message || 'Update failed');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to update contact');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Contact</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                        <input
                            name="name"
                            value={formData.name || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="John Doe"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Organization</label>
                            <input
                                name="organization"
                                value={formData.organization || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                placeholder="Google"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Job Title</label>
                            <input
                                name="title"
                                value={formData.title || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                placeholder="Engineer"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                        <input
                            name="email"
                            value={formData.email || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="john@example.com"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditContactModal;
