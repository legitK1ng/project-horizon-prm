import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CallRecord } from '@/types';
import { ICONS } from '@/constants';
import { formatDuration } from '@/utils/helpers';
import { ChevronDown, ChevronUp, Search, Plus, Calendar, Users, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateCall, useSystemTags } from '@/hooks/useHorizonData';
import TagPicker from '@/components/common/TagPicker';
import DateRangePicker from '@/components/common/DateRangePicker';
import ContactHoverCard from '@/components/common/ContactHoverCard';
import TranscriptView from '@/components/common/TranscriptView';
import Skeleton from '@/components/common/Skeleton';
import PremiumButton from '@/components/common/PremiumButton';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useVirtualizer } from '@tanstack/react-virtual';


interface CallLogProps {
    activeTag?: string | null;
    onContactClick?: (contactName: string) => void;
}

const CallLog: React.FC<CallLogProps> = ({ activeTag, onContactClick }) => {
    // Real Production Data Hook (Local-First via Dexie)
    const rawCalls = useLiveQuery(() => db.call_records.orderBy('timestamp').reverse().toArray());
    const isLoading = rawCalls === undefined;
    const calls = rawCalls || [];

    const { mutateAsync: updateCallMutation } = useUpdateCall();
    const { data: availableTags = [] } = useSystemTags();
    
    const updateCall = async (updatedCall: any) => {
        try {
            await updateCallMutation({
                id: updatedCall.id,
                data: {
                    tags: updatedCall.tags,
                    sentiment: updatedCall.sentiment,
                    contact_id: updatedCall.contact_id,
                    transcript: updatedCall.transcript
                }
            });
        } catch (error) {
            console.error('Failed to update call:', error);
        }
    };

    // Premium Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15, scale: 0.98 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { type: 'spring', stiffness: 120, damping: 14 } as const,
        },
    };
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
        if (groupBy === 'contact') {
            const index = flatGroupedItems.findIndex(
                item => item.type === 'contact_header' && item.contactName.charAt(0).toUpperCase() === letter
            );
            if (index !== -1) {
                rowVirtualizer.scrollToIndex(index, { align: 'start' });
            }
        }
    };

    const handleToggleTag = async (call: CallRecord, tag: string) => {
        const currentTags = call.tags || [];
        const newTags = currentTags.includes(tag)
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag];

        // Update local and backend
        const updatedCall = { ...call, tags: newTags };

        // Also update executive_brief tags if they exist to keep in sync
        if (updatedCall.executive_brief) {
            updatedCall.executive_brief = {
                ...updatedCall.executive_brief,
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

    const filteredCalls = (calls || []).filter(call => {
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
        const contactName = call.contact_name || '';
        const transcript = (call as any).transcript || '';
        return contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            transcript.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Grouping Logic
    const groupedCalls = React.useMemo(() => {
        if (groupBy === 'date') return null;

        const groups: Record<string, CallRecord[]> = {};
        filteredCalls.forEach(call => {
            const name = call.contact_name || 'Unknown';
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

    const parentRef = useRef<HTMLDivElement>(null);

    const flatGroupedItems = React.useMemo(() => {
        if (groupBy === 'date' || !groupedCalls) return [];
        
        const items: any[] = [];
        groupedCalls.forEach(([contactName, calls]) => {
            items.push({ type: 'contact_header', contactName, calls });
            
            if (expandedGroup === contactName) {
                // Sub-group calls by date
                const dateGroups: Record<string, CallRecord[]> = {};
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
                        label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    }

                    const group = dateGroups[label] || [];
                    group.push(call);
                    dateGroups[label] = group;
                });

                Object.entries(dateGroups).forEach(([dateLabel, groupCalls]) => {
                    items.push({ type: 'date_header', label: dateLabel });
                    groupCalls.forEach(call => {
                        items.push({ type: 'call_item', call });
                    });
                });
            }
        });
        return items;
    }, [groupedCalls, expandedGroup, groupBy]);

    const rowVirtualizer = useVirtualizer({
        count: groupBy === 'date' ? filteredCalls.length : flatGroupedItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            if (groupBy === 'date') {
                const call = filteredCalls[index];
                return expandedId === call?.id ? 250 : 100;
            } else {
                const item = flatGroupedItems[index];
                if (item?.type === 'contact_header') return 80;
                if (item?.type === 'date_header') return 30;
                if (item?.type === 'call_item') {
                    return expandedId === item.call.id ? 250 : 70;
                }
                return 100;
            }
        },
        overscan: 10,
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl lg:text-6xl font-black tracking-tighter leading-tight text-slate-900 dark:text-white uppercase italic">
                        Call <span className="text-blue-600 dark:text-blue-400">Archives</span>
                    </h2>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-[0.2em] opacity-70">
                        Historical intelligence interaction logs.
                    </p>
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

            <div className="flex gap-6 relative h-[calc(100vh-12rem)]">
                {/* Main List */}
                <motion.div
                  ref={parentRef}
                  className={cn(
                    "flex-1 rounded-[2.5rem] overflow-y-auto",
                    "glass-premium",
                    "border border-white/10 dark:border-white/5",
                    "shadow-2xl shadow-black/20"
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <div className="absolute inset-0 bg-carbon opacity-[0.03] dark:opacity-[0.05] -z-10" />
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-4">
                                    <Skeleton variant="circular" className="w-10 h-10" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton variant="text" className="w-1/3" />
                                        <Skeleton variant="text" className="w-1/4 h-3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredCalls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                            <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
                                <Search size={40} className="text-slate-300 dark:text-slate-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No calls found</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-xs">
                                We couldn't find any call records matching your current filters or search terms.
                            </p>
                        </div>
                    ) : (
                        <motion.div 
                            className=""
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            {groupBy === 'date' ? (
                                // DATE VIEW (Virtualized)
                                <div
                                    style={{
                                        height: `${rowVirtualizer.getTotalSize()}px`,
                                        width: '100%',
                                        position: 'relative',
                                    }}
                                >
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const call = filteredCalls[virtualRow.index];
                                        return (
                                            <div
                                                key={virtualRow.key}
                                                ref={rowVirtualizer.measureElement}
                                                data-index={virtualRow.index}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                }}
                                                className="border-b border-slate-100 dark:border-slate-800"
                                            >
                                                <motion.div 
                                                    variants={itemVariants}
                                                    className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                                >
                                                    <div
                                                        className="p-4 cursor-pointer flex items-center justify-between"
                                                        onClick={() => toggleExpand(call.id)}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-2 rounded-lg ${getStatusColor(call.status)}`}>
                                                                {ICONS.Logs}
                                                            </div>
                                                            <div>
                                                                <ContactHoverCard contactName={call.contact_name || 'Unknown'} phoneNumber={call.phone_number || undefined}>
                                                                    <h4 className="font-black text-lg text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase italic tracking-tighter">
                                                                        {call.contact_name}
                                                                    </h4>
                                                                </ContactHoverCard>
                                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-70">
                                                                    <span>{new Date(call.timestamp).toLocaleString()}</span>
                                                                    <span>•</span>
                                                                    <span>{formatDuration(call.duration || 0)}</span>
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
                                                            {call.executive_brief && (
                                                                <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                                                    <h5 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                                                                        {ICONS.Dashboard} Executive Brief
                                                                    </h5>
                                                                    <p className="text-slate-700 dark:text-slate-300 mb-3">{call.executive_brief.summary}</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {call.executive_brief.tags?.map((tag: string) => (
                                                                            <span key={tag} className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded border border-slate-200 dark:border-slate-700">
                                                                                #{tag}
                                                                            </span>
                                                                        ))}

                                                                        {/* Tag Picker Trigger */}
                                                                        <div className="relative inline-block">
                                                                            <PremiumButton
                                                                                size="sm"
                                                                                variant="secondary"
                                                                                className="h-7 px-2 rounded-lg"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setEditingTagsId(editingTagsId === call.id ? null : call.id);
                                                                                }}
                                                                                icon={<Plus size={12} />}
                                                                            >
                                                                                Tags
                                                                            </PremiumButton>

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

                                                            <TranscriptView
                                                                transcript={(call as any).transcript || ''}
                                                                contactName={call.contact_name || 'Unknown'}
                                                            />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                // GROUP BY CONTACT VIEW (Virtualized)
                                <div
                                    style={{
                                        height: `${rowVirtualizer.getTotalSize()}px`,
                                        width: '100%',
                                        position: 'relative',
                                    }}
                                >
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const item = flatGroupedItems[virtualRow.index];
                                        if (!item) return null;

                                        return (
                                            <div
                                                key={virtualRow.key}
                                                ref={rowVirtualizer.measureElement}
                                                data-index={virtualRow.index}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                }}
                                            >
                                                {item.type === 'contact_header' && (
                                                    <motion.div
                                                        className={cn(
                                                            "card glass rounded-2xl overflow-hidden mb-2 mx-4 mt-2",
                                                            "bg-white/70 dark:bg-slate-900/70",
                                                            "border border-slate-200/50 dark:border-slate-700/50",
                                                            "backdrop-blur-xl"
                                                        )}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ type: 'spring', stiffness: 120, damping: 14 } as const}
                                                        whileHover={{ scale: 1.01 }}
                                                    >
                                                        <div
                                                            className="p-4 flex items-center justify-between cursor-pointer bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                            onClick={() => toggleGroup(item.contactName)}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <ContactHoverCard contactName={item.contactName} phoneNumber={item.calls[0]?.phone_number || undefined} onContactClick={onContactClick}>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm border border-blue-200 dark:border-blue-800">
                                                                            {item.contactName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                                                {item.contactName}
                                                                            </h3>
                                                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                                                <Phone size={12} />
                                                                                <span>{item.calls.length} calls</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </ContactHoverCard>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {expandedGroup === item.contactName ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}

                                                {item.type === 'date_header' && (
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-12 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider border-x border-slate-200/50 dark:border-slate-700/50 mx-8">
                                                        {item.label}
                                                    </div>
                                                )}

                                                {item.type === 'call_item' && (
                                                    <div className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 relative border-x border-b border-slate-200/50 dark:border-slate-700/50 mx-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
                                                        <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

                                                        <div
                                                            className="p-4 cursor-pointer flex items-center justify-between relative"
                                                            onClick={() => toggleExpand(item.call.id)}
                                                        >
                                                            <div className={`absolute left-[1.7rem] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-white dark:border-slate-900 ${item.call.status === 'COMPLETED' ? 'bg-emerald-500' :
                                                                item.call.status === 'ERROR' ? 'bg-rose-500' : 'bg-amber-500'
                                                                }`} />

                                                            <div className="flex items-center gap-4 pl-12">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`text-sm ${getStatusColor(item.call.status)} font-medium`}>
                                                                            {new Date(item.call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                                        {formatDuration(item.call.duration || 0)}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4">
                                                                {expandedId === item.call.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                                            </div>
                                                        </div>

                                                        {expandedId === item.call.id && (
                                                            <div className="px-4 pb-4 pl-16 animate-in slide-in-from-top-2 duration-200">
                                                                {item.call.executive_brief && (
                                                                    <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                                                        <p className="text-slate-700 dark:text-slate-300 text-sm mb-2">{item.call.executive_brief.summary}</p>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {item.call.executive_brief.tags?.map((tag: string) => (
                                                                                <span key={tag} className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded border border-slate-200 dark:border-slate-700">
                                                                                    #{tag}
                                                                                </span>
                                                                            ))}
                                                                            <div className="relative inline-block">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setEditingTagsId(editingTagsId === item.call.id ? null : item.call.id);
                                                                                    }}
                                                                                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs rounded border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1"
                                                                                >
                                                                                    <Plus size={10} />
                                                                                    <span>Tags</span>
                                                                                </button>

                                                                                {editingTagsId === item.call.id && (
                                                                                    <TagPicker
                                                                                        selectedTags={item.call.tags || []}
                                                                                        availableTags={availableTags}
                                                                                        onToggleTag={(tag) => handleToggleTag(item.call, tag)}
                                                                                        onCreateTag={(tag) => handleToggleTag(item.call, tag)}
                                                                                        onClose={() => setEditingTagsId(null)}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <TranscriptView
                                                                    transcript={(item.call as any).transcript || ''}
                                                                    contactName={item.call.contact_name || 'Unknown'}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}
                </motion.div>

                {/* ALPHABET SCROLLER */}
                {groupBy === 'contact' && (
                    <motion.div
                      className={cn(
                        "w-6 hidden md:flex flex-col items-center justify-center gap-1 fixed right-4 top-1/2 -translate-y-1/2 p-1 rounded-full z-10 max-h-[80vh] overflow-y-auto",
                        "glass backdrop-blur-xl",
                        "bg-white/70 dark:bg-slate-900/70",
                        "border border-slate-200/50 dark:border-slate-700/50"
                      )}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                        {alphabet.map(letter => (
                            <button
                                key={letter}
                                onClick={() => scrollToLetter(letter)}
                                className="w-5 h-5 text-[10px] font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                {letter}
                            </button>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default CallLog;
