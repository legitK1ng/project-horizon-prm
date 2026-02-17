import React, { useState } from 'react';
import { CallRecord } from '@/types';
import { ICONS } from '@/constants';
import { formatDuration, cleanTranscript } from '@/utils/helpers';
import { ChevronDown, ChevronUp, Search, Plus, Calendar, Users, Phone } from 'lucide-react';
import { useData } from '@/hooks/useData';
import TagPicker from '@/components/common/TagPicker';
import DateRangePicker from '@/components/common/DateRangePicker';
import ContactHoverCard from '@/components/common/ContactHoverCard';

interface CallLogProps {
    calls: CallRecord[];
    activeTag?: string | null;
}

const CallLog: React.FC<CallLogProps> = ({ calls, activeTag }) => {
    const { tags: availableTags, updateCall } = useData();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [groupBy, setGroupBy] = useState<'date' | 'contact'>('date');
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
        if (expandedId !== id) setEditingTagsId(null); // Close picker when switching
    };

    const toggleGroup = (groupKey: string) => {
        setExpandedGroup(expandedGroup === groupKey ? null : groupKey);
    };

    const scrollToLetter = (letter: string) => {
        const element = document.getElementById(`group-${letter}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleToggleTag = async (call: CallRecord, tag: string) => {
        const currentTags = call.tags || [];
        const newTags = currentTags.includes(tag)
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag];

        // Update local and backend
        // Note: CallRecord interface might need 'tags' if it was missing? 
        // apiService.ts transformLog ensures it has tags.
        const updatedCall = { ...call, tags: newTags };

        // Also update executiveBrief tags if they exist to keep in sync?
        if (updatedCall.executiveBrief) {
            updatedCall.executiveBrief = {
                ...updatedCall.executiveBrief,
                tags: newTags
            };
        }

        await updateCall(updatedCall);
    };

    const getStatusColor = (status: CallRecord['status']) => {
        switch (status) {
            case 'COMPLETED': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400';
            case 'QUEUED': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
            case 'ERROR': return 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const filteredCalls = calls.filter(call => {
        // Tag Filter
        if (activeTag) {
            const hasTag = call.tags?.some(tag => tag.toLowerCase() === activeTag.toLowerCase());
            if (!hasTag) return false;
        }

        // Date Range Filter
        if (dateRange.start) {
            const callDate = new Date(call.timestamp);
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0); // Start of day
            if (callDate < startDate) return false;
        }
        if (dateRange.end) {
            const callDate = new Date(call.timestamp);
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999); // End of day
            if (callDate > endDate) return false;
        }

        // Search Filter
        const contactName = call.contactName || '';
        const transcript = call.transcript || '';
        return contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            transcript.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Grouping Logic
    const groupedCalls = React.useMemo(() => {
        if (groupBy === 'date') return null;

        const groups: Record<string, CallRecord[]> = {};
        filteredCalls.forEach(call => {
            const name = call.contactName || 'Unknown';
            if (!groups[name]) groups[name] = [];
            groups[name].push(call);
        });

        // Sort by name
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredCalls, groupBy]);

    const alphabet = React.useMemo(() => {
        if (!groupedCalls) return [];
        const letters = new Set(groupedCalls.map(([name]) => name.charAt(0).toUpperCase()));
        return Array.from(letters).sort();
    }, [groupedCalls]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Call Logs</h2>
                    <p className="text-slate-500 dark:text-slate-400">History of all analyzed conversations.</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Group By Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button
                            onClick={() => setGroupBy('date')}
                            className={`p-2 rounded-md transition-all ${groupBy === 'date'
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            title="Sort by Date"
                        >
                            <Calendar size={18} />
                        </button>
                        <button
                            onClick={() => setGroupBy('contact')}
                            className={`p-2 rounded-md transition-all ${groupBy === 'contact'
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            title="Group by Contact"
                        >
                            <Users size={18} />
                        </button>
                    </div>

                    <DateRangePicker
                        value={dateRange}
                        onChange={setDateRange}
                    />

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search calls..."
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-6 relative">
                {/* Main List */}
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {filteredCalls.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            {ICONS.Logs}
                            <p className="mt-2">No calls found matching your search.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {groupBy === 'date' ? (
                                // DATE VIEW (Original)
                                filteredCalls.map((call) => (
                                    <div key={call.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <div
                                            className="p-4 cursor-pointer flex items-center justify-between"
                                            onClick={() => toggleExpand(call.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg ${getStatusColor(call.status)}`}>
                                                    {ICONS.Logs}
                                                </div>
                                                <div>
                                                    <ContactHoverCard contactName={call.contactName || 'Unknown'} phoneNumber={call.phoneNumber}>
                                                        <h4 className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                            {call.contactName}
                                                        </h4>
                                                    </ContactHoverCard>
                                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                                        <span>{new Date(call.timestamp).toLocaleString()}</span>
                                                        <span>•</span>
                                                        <span>{formatDuration(call.duration)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                                                    {call.status}
                                                </span>
                                                {expandedId === call.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                            </div>
                                        </div>

                                        {expandedId === call.id && (
                                            <div className="px-4 pb-4 pl-[4.5rem] animate-in slide-in-from-top-2 duration-200">
                                                {call.executiveBrief && (
                                                    <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                                        <h5 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                                                            {ICONS.Dashboard} Executive Brief
                                                        </h5>
                                                        <p className="text-slate-700 dark:text-slate-300 mb-3">{call.executiveBrief.summary}</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {call.executiveBrief.tags.map(tag => (
                                                                <span key={tag} className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded border border-slate-200 dark:border-slate-700">
                                                                    #{tag}
                                                                </span>
                                                            ))}

                                                            {/* Tag Picker Trigger */}
                                                            <div className="relative inline-block">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingTagsId(editingTagsId === call.id ? null : call.id);
                                                                    }}
                                                                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs rounded border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1"
                                                                    title="Add/Edit Tags"
                                                                >
                                                                    <Plus size={10} />
                                                                    <span>Tags</span>
                                                                </button>

                                                                {editingTagsId === call.id && (
                                                                    <TagPicker
                                                                        selectedTags={call.tags || []}
                                                                        availableTags={availableTags}
                                                                        onToggleTag={(tag) => handleToggleTag(call, tag)}
                                                                        onCreateTag={(tag) => handleToggleTag(call, tag)}
                                                                        onClose={() => setEditingTagsId(null)}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Transcript</h5>
                                                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
                                                        {cleanTranscript(call.transcript)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                // GROUP BY CONTACT VIEW
                                groupedCalls?.map(([contactName, calls]) => {
                                    const firstChar = contactName.charAt(0).toUpperCase();

                                    return (
                                        <div key={contactName} id={`group-${firstChar}`} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:shadow-md">
                                            {/* Group Header */}
                                            <div
                                                className="p-4 flex items-center justify-between cursor-pointer bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                onClick={() => toggleGroup(contactName)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <ContactHoverCard contactName={contactName} phoneNumber={calls[0] ? calls[0].phoneNumber : undefined}>
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm border border-blue-200 dark:border-blue-800">
                                                                {contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                                    {contactName}
                                                                </h3>
                                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                                    <Phone size={12} />
                                                                    <span>{calls.length} calls</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </ContactHoverCard>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {expandedGroup === contactName ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                                </div>
                                            </div>

                                            {expandedGroup === contactName && (
                                                <div className="divide-y divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
                                                    {(() => {
                                                        // Sub-group calls by date
                                                        const dateGroups: Record<string, CallRecord[]> = {};

                                                        // Sort calls desc first
                                                        const sortedGroupCalls = [...calls].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                                                        sortedGroupCalls.forEach(call => {
                                                            const date = new Date(call.timestamp);
                                                            const today = new Date();
                                                            const yesterday = new Date();
                                                            yesterday.setDate(today.getDate() - 1);

                                                            let label = date.toLocaleDateString();
                                                            if (date.toDateString() === today.toDateString()) {
                                                                label = 'Today';
                                                            } else if (date.toDateString() === yesterday.toDateString()) {
                                                                label = 'Yesterday';
                                                            } else {
                                                                // Use a nice format for older dates
                                                                label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                                                            }

                                                            const group = dateGroups[label] || [];
                                                            group.push(call);
                                                            dateGroups[label] = group;
                                                        });

                                                        return Object.entries(dateGroups).map(([dateLabel, groupCalls]) => (
                                                            <div key={dateLabel}>
                                                                {/* Date Sub-header */}
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 px-12 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                                    {dateLabel}
                                                                </div>

                                                                {groupCalls.map(call => (
                                                                    <div key={call.id} className="pl-12 group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 relative">
                                                                        {/* Connecting Line */}
                                                                        <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

                                                                        <div
                                                                            className="p-4 cursor-pointer flex items-center justify-between relative"
                                                                            onClick={() => toggleExpand(call.id)}
                                                                        >
                                                                            {/* Status Dot on Line */}
                                                                            <div className={`absolute left-[-1.05rem] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-white dark:border-slate-900 ${call.status === 'COMPLETED' ? 'bg-emerald-500' :
                                                                                call.status === 'ERROR' ? 'bg-rose-500' : 'bg-amber-500'
                                                                                }`} />

                                                                            <div className="flex items-center gap-4">
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className={`text-sm ${getStatusColor(call.status)} font-medium`}>
                                                                                            {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                                                        {formatDuration(call.duration)}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-4">
                                                                                {expandedId === call.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                                                            </div>
                                                                        </div>

                                                                        {/* EXPANDED DETAILS (Reused from Date view, simplified) */}
                                                                        {expandedId === call.id && (
                                                                            <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                                                                                {call.executiveBrief && (
                                                                                    <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                                                                        <p className="text-slate-700 dark:text-slate-300 text-sm mb-2">{call.executiveBrief.summary}</p>
                                                                                        <div className="flex flex-wrap gap-2">
                                                                                            {call.executiveBrief.tags.map(tag => (
                                                                                                <span key={tag} className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded border border-slate-200 dark:border-slate-700">
                                                                                                    #{tag}
                                                                                                </span>
                                                                                            ))}
                                                                                            {/* Tag Picker */}
                                                                                            <div className="relative inline-block">
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        setEditingTagsId(editingTagsId === call.id ? null : call.id);
                                                                                                    }}
                                                                                                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs rounded border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1"
                                                                                                >
                                                                                                    <Plus size={10} />
                                                                                                    <span>Tags</span>
                                                                                                </button>

                                                                                                {editingTagsId === call.id && (
                                                                                                    <TagPicker
                                                                                                        selectedTags={call.tags || []}
                                                                                                        availableTags={availableTags}
                                                                                                        onToggleTag={(tag) => handleToggleTag(call, tag)}
                                                                                                        onCreateTag={(tag) => handleToggleTag(call, tag)}
                                                                                                        onClose={() => setEditingTagsId(null)}
                                                                                                    />
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                <div>
                                                                                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed whitespace-pre-wrap line-clamp-3 hover:line-clamp-none cursor-pointer">
                                                                                        {cleanTranscript(call.transcript)}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* ALPHABET SCROLLER */}
                {groupBy === 'contact' && (
                    <div className="w-6 hidden md:flex flex-col items-center justify-center gap-1 fixed right-4 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm z-10 max-h-[80vh] overflow-y-auto">
                        {alphabet.map(letter => (
                            <button
                                key={letter}
                                onClick={() => scrollToLetter(letter)}
                                className="w-5 h-5 text-[10px] font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallLog;
