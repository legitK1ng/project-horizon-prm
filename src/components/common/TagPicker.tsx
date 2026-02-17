import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check } from 'lucide-react';

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
            onCreateTag(search.trim());
            setSearch('');
        }
    };

    return (
        <div
            ref={containerRef}
            className="absolute z-50 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 top-full right-0"
        >
            <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                {/* Search Header */}
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Enter label name"
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm text-slate-700 dark:text-slate-200 transition-colors"
                            onClick={() => onToggleTag(tag)}
                        >
                            <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-500'
                                }`}>
                                {isSelected && <Check size={10} strokeWidth={3} />}
                            </div>
                            <span className="truncate flex-1">{tag}</span>
                        </div>
                    );
                })}

                {/* Create Option */}
                {search.trim() && !isExactMatch && onCreateTag && (
                    <div
                        className="px-3 py-2 flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-sm text-blue-600 dark:text-blue-400 border-t border-slate-100 dark:border-slate-700 mt-1"
                        onClick={handleCreate}
                    >
                        <Plus size={14} />
                        <span className="truncate">Create "{search}"</span>
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
