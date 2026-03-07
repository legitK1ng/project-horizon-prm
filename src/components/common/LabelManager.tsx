import React, { useState } from 'react';
import { X, Plus, Trash2, Tag } from 'lucide-react';

interface LabelManagerProps {
    labels: string[];
    onClose: () => void;
    onDeleteLabel: (label: string) => void;
    onCreateLabel: (label: string) => void;
}

const LabelManager: React.FC<LabelManagerProps> = ({ labels, onClose, onDeleteLabel, onCreateLabel }) => {
    const [newLabel, setNewLabel] = useState('');

    const handleCreate = () => {
        const trimmed = newLabel.trim();
        if (trimmed && !labels.includes(trimmed)) {
            onCreateLabel(trimmed);
            setNewLabel('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCreate();
        if (e.key === 'Escape') onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Tag size={16} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Manage Labels</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Create New Label */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Create new label..."
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={!newLabel.trim()}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                            <Plus size={16} />
                            Add
                        </button>
                    </div>
                </div>

                {/* Label List */}
                <div className="p-3 max-h-64 overflow-y-auto">
                    {labels.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-sm">
                            No labels yet. Create one above.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {labels.map((label) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                                    </div>
                                    <button
                                        onClick={() => onDeleteLabel(label)}
                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 text-slate-400 rounded-lg transition-all"
                                        title="Delete label"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-400 text-center">
                        {labels.length} label{labels.length !== 1 ? 's' : ''} total
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LabelManager;
