import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

interface TagPickerProps {
    selectedTags: string[];
    availableTags: string[];
    onToggleTag: (tag: string) => void;
    onCreateTag?: (tag: string) => void;
    onClose: () => void;
}

const TagPicker: React.FC<TagPickerProps> = ({
    selectedTags,
    availableTags,
    onToggleTag,
    onCreateTag,
    onClose,
}) => {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }

        // Click outside listener
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const filteredTags = availableTags.filter((tag) =>
        tag.toLowerCase().includes(search.toLowerCase())
    );

    const isExactMatch = filteredTags.some(
        (t) => t.toLowerCase() === search.trim().toLowerCase()
    );

    const handleCreate = () => {
        if (search.trim() && onCreateTag) {
            triggerHaptic('MEDIUM');
            onCreateTag(search.trim());
            setSearch('');
        }
    };

    const handleToggle = (tag: string) => {
        triggerHaptic('LIGHT');
        onToggleTag(tag);
    };

    return (
        <div
            ref={containerRef}
            className="absolute z-50 w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 animate-in fade-in zoom-in-95 duration-200 top-full right-0 mt-2 overflow-hidden"
        >
            <div className="p-3 border-b border-white/10 dark:border-slate-800">
                {/* Search Header */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Filter labels..."
                        className="w-full pl-9 pr-3 py-2 text-[11px] font-black uppercase tracking-wider bg-slate-100/50 dark:bg-slate-950/50 border border-white/10 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-horizon-500/50 transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && search.trim() && !isExactMatch) {
                                handleCreate();
                            }
                        }}
                    />
                </div>
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto py-1 thin-scrollbar">
                {filteredTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                        <div
                            key={tag}
                            className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/10 dark:hover:bg-slate-800/50 cursor-pointer group transition-colors"
                            onClick={() => handleToggle(tag)}
                        >
                            <div className={`w-4 h-4 border rounded-md flex items-center justify-center transition-all duration-300 ${isSelected
                                ? 'bg-horizon-500 border-horizon-500 text-white shadow-glow'
                                : 'border-slate-300 dark:border-slate-700 group-hover:border-horizon-400'
                                }`}>
                                {isSelected && <Check size={10} strokeWidth={4} />}
                            </div>
                            <span className={`truncate flex-1 text-[11px] font-bold uppercase tracking-tight ${isSelected ? 'text-horizon-600 dark:text-horizon-400' : 'text-slate-600 dark:text-slate-400'}`}>{tag}</span>
                        </div>
                    );
                })}

                {/* Create Option */}
                {search.trim() && !isExactMatch && onCreateTag && (
                    <div
                        className="px-4 py-3 flex items-center gap-3 hover:bg-horizon-500/10 cursor-pointer text-horizon-600 dark:text-horizon-400 border-t border-white/5 dark:border-slate-800 mt-1"
                        onClick={handleCreate}
                    >
                        <Plus size={14} strokeWidth={3} />
                        <span className="truncate text-[10px] font-black uppercase tracking-[0.1em]">Create "{search}"</span>
                    </div>
                )}


                {filteredTags.length === 0 && !search && (
                    <div className="px-4 py-8 text-center text-xs text-slate-400">
                        No labels yet
                    </div>
                )}
            </div>
        </div>
    );
};

export default TagPicker;
