import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppView, CallRecord, Contact } from '@/types';
import { APP_VIEW } from '@/constants';
import { Search, ArrowRight, Phone, Users, FileText, LayoutDashboard, FlaskConical, History, Command } from 'lucide-react';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: AppView) => void;
    calls: CallRecord[];
    contacts: Contact[];
    onSelectCall?: (callId: string) => void;
}

interface SearchResult {
    id: string;
    type: 'view' | 'call' | 'contact' | 'action';
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onSelect: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    onNavigate,
    calls,
    contacts,
    onSelectCall,
}) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            // Small delay to let animation start
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // View navigation results (always available)
    const viewResults: SearchResult[] = useMemo(() => [
        { id: 'nav-dashboard', type: 'view' as const, icon: <LayoutDashboard size={16} />, title: 'Dashboard', subtitle: 'Executive summary', onSelect: () => { onNavigate(APP_VIEW.DASHBOARD); onClose(); } },
        { id: 'nav-logs', type: 'view' as const, icon: <Phone size={16} />, title: 'Call Logs', subtitle: 'History of conversations', onSelect: () => { onNavigate(APP_VIEW.LOGS); onClose(); } },
        { id: 'nav-contacts', type: 'view' as const, icon: <Users size={16} />, title: 'Contacts', subtitle: 'Google Contacts sync', onSelect: () => { onNavigate(APP_VIEW.CONTACTS); onClose(); } },
        { id: 'nav-actions', type: 'view' as const, icon: <History size={16} />, title: 'Actions Log', subtitle: 'Manage action items', onSelect: () => { onNavigate(APP_VIEW.ACTIONS); onClose(); } },
        { id: 'nav-lab', type: 'view' as const, icon: <FlaskConical size={16} />, title: 'Processing Lab', subtitle: 'AI analysis & diagnostics', onSelect: () => { onNavigate(APP_VIEW.LAB); onClose(); } },
    ], [onNavigate, onClose]);

    // Quick Actions results (Semantic shortcuts)
    const quickActions: SearchResult[] = useMemo(() => [
        { id: 'act-new-pulse', type: 'action' as const, icon: <FlaskConical size={16} />, title: 'Capture New Pulse', subtitle: 'Analyze a fresh call transcript', onSelect: () => { onNavigate(APP_VIEW.LAB); onClose(); } },
        { id: 'act-log-call', type: 'action' as const, icon: <Phone size={16} />, title: 'Log Manual Call', subtitle: 'Record an interaction without transcription', onSelect: () => { onClose(); } },
        { id: 'act-osint', type: 'action' as const, icon: <Search size={16} />, title: 'Run OSINT Enrichment', subtitle: 'Scrape professional signals for a contact', onSelect: () => { onClose(); } },
    ], [onNavigate, onClose]);

    // Grouping logic for "Semantic" Search
    const results: SearchResult[] = useMemo(() => {
        const q = query.toLowerCase().trim();

        // Always include matched actions at the top if there's a query
        const actionMatches = quickActions.filter(a => a.title.toLowerCase().includes(q) || a.subtitle?.toLowerCase().includes(q));

        if (!q) {
            return [...viewResults, ...quickActions];
        }

        const matches: SearchResult[] = [...actionMatches];

        // Search views
        viewResults.forEach(v => {
            if (v.title.toLowerCase().includes(q) || v.subtitle?.toLowerCase().includes(q)) {
                matches.push(v);
            }
        });

        // Search calls
        calls.forEach(call => {
            const contactName = (call.contact_name || '').toLowerCase();
            const briefTitle = (call.executive_brief?.title || '').toLowerCase();
            const tags = (call.tags || []).join(' ').toLowerCase();

            if (contactName.includes(q) || briefTitle.includes(q) || tags.includes(q)) {
                matches.push({
                    id: `call-${call.id}`,
                    type: 'call',
                    icon: <FileText size={16} />,
                    title: call.executive_brief?.title || call.contact_name || 'Strategic Pulse',
                    subtitle: `${call.contact_name} · ${new Date(call.timestamp).toLocaleDateString()}`,
                    onSelect: () => {
                        onNavigate(APP_VIEW.LOGS);
                        if (onSelectCall) onSelectCall(call.id);
                        onClose();
                    },
                });
            }
        });

        // Search contacts
        contacts.forEach(contact => {
            const displayName = contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown Contact';
            const org = (contact.organization_id || '').toLowerCase();

            if (displayName.toLowerCase().includes(q) || org.includes(q)) {
                matches.push({
                    id: `contact-${contact.id}`,
                    type: 'contact',
                    icon: <Users size={16} />,
                    title: displayName,
                    subtitle: contact.organization_id || 'Professional Connection',
                    onSelect: () => {
                        onNavigate(APP_VIEW.CONTACTS);
                        onClose();
                    },
                });
            }
        });

        return matches.slice(0, 15);
    }, [query, calls, contacts, viewResults, quickActions, onNavigate, onClose, onSelectCall]);

    // Keep selected index in bounds
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selected = listRef.current.children[selectedIndex] as HTMLElement;
            if (selected) {
                selected.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                results[selectedIndex]?.onSelect();
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [results, selectedIndex, onClose]);

    // NOTE: Global Ctrl+K keyboard shortcut is managed by parent (Dashboard).
    // This component only handles internal keyboard navigation (arrows, enter, esc).

    if (!isOpen) return null;

    const typeLabels: Record<string, string> = {
        view: 'Navigation',
        call: 'Calls',
        contact: 'Contacts',
        action: 'Actions',
    };

    // Group results by type
    const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
        if (!acc[r.type]) acc[r.type] = [];
        acc[r.type]!.push(r);
        return acc;
    }, {});

    let flatIndex = 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />

            {/* Palette */}
            <div
                className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <Search size={20} className="text-slate-400 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search calls, contacts, or navigate..."
                        className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none text-base"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs rounded-md font-mono">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-80 overflow-y-auto thin-scrollbar py-2">
                    {results.length === 0 ? (
                        <div className="px-5 py-8 text-center text-slate-400 text-sm">
                            No results found for "{query}"
                        </div>
                    ) : (
                        Object.entries(groupedResults).map(([type, items]) => (
                            <div key={type}>
                                <div className="px-5 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {typeLabels[type] || type}
                                </div>
                                {items.map((result) => {
                                    const currentIndex = flatIndex++;
                                    return (
                                        <button
                                            key={result.id}
                                            onClick={result.onSelect}
                                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                                            className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${selectedIndex === currentIndex
                                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                }`}
                                        >
                                            <div className={`flex-shrink-0 ${selectedIndex === currentIndex
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-slate-400'
                                                }`}>
                                                {result.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${selectedIndex === currentIndex
                                                    ? 'text-blue-700 dark:text-blue-300'
                                                    : 'text-slate-800 dark:text-slate-200'
                                                    }`}>
                                                    {result.title}
                                                </p>
                                                {result.subtitle && (
                                                    <p className="text-xs text-slate-400 truncate">{result.subtitle}</p>
                                                )}
                                            </div>
                                            {selectedIndex === currentIndex && (
                                                <ArrowRight size={14} className="text-blue-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">↑↓</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">↵</kbd>
                            Select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">esc</kbd>
                            Close
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Command size={11} />
                        <span>K to open</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
