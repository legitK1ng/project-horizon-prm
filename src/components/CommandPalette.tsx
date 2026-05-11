import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppView, CallRecord, Contact } from '@/types';
import { APP_VIEW } from '@/constants';
import { 
    Search, 
    ArrowRight, 
    Phone, 
    Users, 
    FileText, 
    LayoutDashboard, 
    FlaskConical, 
    History, 
    X,
    Sparkles,
    Zap,
    Target
} from 'lucide-react';
import { cn } from '@/utils/ui';
import { triggerHaptic } from '@/utils/haptics';

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
            triggerHaptic('MEDIUM');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // View navigation results
    const viewResults: SearchResult[] = useMemo(() => [
        { id: 'nav-dashboard', type: 'view' as const, icon: <LayoutDashboard size={16} />, title: 'Dashboard', subtitle: 'Strategic overview', onSelect: () => { onNavigate(APP_VIEW.DASHBOARD); onClose(); } },
        { id: 'nav-logs', type: 'view' as const, icon: <Phone size={16} />, title: 'Intelligence Logs', subtitle: 'Interaction history', onSelect: () => { onNavigate(APP_VIEW.LOGS); onClose(); } },
        { id: 'nav-contacts', type: 'view' as const, icon: <Users size={16} />, title: 'Entity Matrix', subtitle: 'Relationship database', onSelect: () => { onNavigate(APP_VIEW.CONTACTS); onClose(); } },
        { id: 'nav-actions', type: 'view' as const, icon: <History size={16} />, title: 'Mission Log', subtitle: 'Action item tracking', onSelect: () => { onNavigate(APP_VIEW.ACTIONS); onClose(); } },
        { id: 'nav-lab', type: 'view' as const, icon: <FlaskConical size={16} />, title: 'Processing Lab', subtitle: 'AI diagnostics', onSelect: () => { onNavigate(APP_VIEW.LAB); onClose(); } },
    ], [onNavigate, onClose]);

    // Quick Actions
    const quickActions: SearchResult[] = useMemo(() => [
        { id: 'act-new-pulse', type: 'action' as const, icon: <Sparkles size={16} />, title: 'Initialize Capture', subtitle: 'Analyze new transcript', onSelect: () => { onNavigate(APP_VIEW.LAB); onClose(); } },
        { id: 'act-osint', type: 'action' as const, icon: <Target size={16} />, title: 'Signal Extraction', subtitle: 'Run OSINT enrichment', onSelect: () => { onClose(); } },
    ], [onNavigate, onClose]);

    // Search Results
    const results: SearchResult[] = useMemo(() => {
        const q = query.toLowerCase().trim();
        const actionMatches = quickActions.filter(a => a.title.toLowerCase().includes(q) || a.subtitle?.toLowerCase().includes(q));

        if (!q) return [...viewResults, ...quickActions];

        const matches: SearchResult[] = [...actionMatches];

        viewResults.forEach(v => {
            if (v.title.toLowerCase().includes(q) || v.subtitle?.toLowerCase().includes(q)) matches.push(v);
        });

        calls.forEach(call => {
            const contactName = (call.contact_name || '').toLowerCase();
            const briefTitle = (call.executive_brief?.title || '').toLowerCase();
            if (contactName.includes(q) || briefTitle.includes(q)) {
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

        contacts.forEach(contact => {
            const displayName = contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
            if (displayName.toLowerCase().includes(q)) {
                matches.push({
                    id: `contact-${contact.id}`,
                    type: 'contact',
                    icon: <Users size={16} />,
                    title: displayName,
                    subtitle: contact.organization_id || 'Connection',
                    onSelect: () => { onNavigate(APP_VIEW.CONTACTS); onClose(); },
                });
            }
        });

        return matches.slice(0, 10);
    }, [query, calls, contacts, viewResults, quickActions, onNavigate, onClose, onSelectCall]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown': 
                e.preventDefault(); 
                setSelectedIndex(i => {
                    const next = Math.min(i + 1, results.length - 1);
                    if (next !== i) triggerHaptic('LIGHT');
                    return next;
                }); 
                break;
            case 'ArrowUp': 
                e.preventDefault(); 
                setSelectedIndex(i => {
                    const next = Math.max(i - 1, 0);
                    if (next !== i) triggerHaptic('LIGHT');
                    return next;
                }); 
                break;
            case 'Enter': 
                e.preventDefault(); 
                if (results[selectedIndex]) {
                    triggerHaptic('MEDIUM');
                    results[selectedIndex].onSelect();
                }
                break;
            case 'Escape': 
                e.preventDefault(); 
                triggerHaptic('LIGHT');
                onClose(); 
                break;
        }
    }, [results, selectedIndex, onClose]);

    const typeLabels: Record<string, string> = { view: 'Navigation', call: 'Intelligence', contact: 'Entities', action: 'Directives' };

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 } as const}
                        className={cn(
                            "relative w-full max-w-2xl overflow-hidden glass-effect",
                            "rounded-[2.5rem] shadow-elevated border-white/20 dark:border-white/5"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute inset-0 scanline opacity-[0.03] pointer-events-none" />
                        
                        {/* Search Input */}
                        <div className="relative flex items-center gap-4 px-10 py-8 border-b border-slate-200/20 dark:border-white/5 bg-white/10 dark:bg-black/10">
                            <Search size={24} className="text-blue-500 animate-pulse" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="EXECUTE_SEARCH_COMMAND..."
                                className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400/50 outline-none text-2xl font-black tracking-tighter uppercase italic"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <div className="flex items-center gap-3">
                                <kbd className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 bg-slate-950/10 dark:bg-white/5 text-slate-500 text-[10px] rounded-xl border border-slate-950/10 dark:border-white/5 font-black">
                                    ESC
                                </kbd>
                                <button 
                                    onClick={() => { triggerHaptic('LIGHT'); onClose(); }} 
                                    className="p-2 hover:bg-slate-950/10 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-blue-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Results Container */}
                        <div 
                            ref={listRef} 
                            className="max-h-[60vh] overflow-y-auto luxury-scroll p-6 space-y-8"
                        >
                            {results.length === 0 ? (
                                <div className="py-24 flex flex-col items-center justify-center text-center">
                                    <div className="w-24 h-24 rounded-3xl bg-slate-950/5 dark:bg-white/5 flex items-center justify-center mb-8 border border-slate-200/50 dark:border-white/5 animate-float-slow">
                                        <Search size={36} className="text-slate-300 dark:text-slate-600" />
                                    </div>
                                    <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.4em] text-[10px] italic">No matching signals found</p>
                                </div>
                            ) : (
                                Object.entries(results.reduce<Record<string, SearchResult[]>>((acc, r) => {
                                    if (!acc[r.type]) acc[r.type] = [];
                                    acc[r.type]!.push(r);
                                    return acc;
                                }, {})).map(([type, items]) => (
                                    <div key={type} className="space-y-4">
                                        <div className="px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] italic flex items-center gap-4">
                                            <span className="text-blue-500/50">#</span>
                                            {typeLabels[type]}
                                            <div className="h-px flex-1 bg-gradient-to-r from-slate-200/50 to-transparent dark:from-white/5 dark:to-transparent" />
                                        </div>
                                        <div className="space-y-2">
                                            {items.map((result) => {
                                                const globalIndex = results.indexOf(result);
                                                const isSelected = selectedIndex === globalIndex;
                                                return (
                                                    <motion.button
                                                        key={result.id}
                                                        onClick={() => { triggerHaptic('MEDIUM'); result.onSelect(); }}
                                                        onMouseEnter={() => {
                                                            if (selectedIndex !== globalIndex) {
                                                                setSelectedIndex(globalIndex);
                                                                triggerHaptic('LIGHT');
                                                            }
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center gap-6 px-6 py-5 rounded-[1.5rem] text-left transition-all duration-500 relative group overflow-hidden",
                                                            isSelected 
                                                                ? "bg-white dark:bg-slate-800 shadow-premium border border-slate-200/50 dark:border-white/10" 
                                                                : "hover:bg-white/40 dark:hover:bg-white/5 border border-transparent"
                                                        )}
                                                    >
                                                        {isSelected && (
                                                            <motion.div 
                                                                layoutId="selection-glow"
                                                                className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-50"
                                                            />
                                                        )}
                                                        <div className={cn(
                                                            "flex-shrink-0 w-12 h-12 rounded-2xl flex justify-center items-center transition-all duration-700",
                                                            isSelected ? "bg-blue-600 text-white shadow-glow rotate-3" : "bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:rotate-6"
                                                        )}>
                                                            {result.icon}
                                                        </div>
                                                        <div className="flex-1 min-w-0 relative z-10">
                                                            <p className={cn(
                                                                "text-base font-black uppercase tracking-tight italic transition-colors",
                                                                isSelected ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"
                                                            )}>
                                                                {result.title}
                                                            </p>
                                                            {result.subtitle && (
                                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1 opacity-70 italic">{result.subtitle}</p>
                                                            )}
                                                        </div>
                                                        <ArrowRight 
                                                            size={20} 
                                                            className={cn(
                                                                "transition-all duration-700",
                                                                isSelected ? "text-blue-500 translate-x-0 opacity-100" : "text-slate-300 -translate-x-4 opacity-0"
                                                            )} 
                                                        />
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer Overlay */}
                        <div className="flex items-center justify-between px-10 py-6 border-t border-slate-200/20 dark:border-white/5 bg-slate-50/30 dark:bg-black/20 backdrop-blur-xl">
                            <div className="flex items-center gap-8 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest italic">
                                <span className="flex items-center gap-3">
                                    <kbd className="px-2.5 py-1.5 bg-slate-950/10 dark:bg-white/5 rounded-xl text-[9px] font-mono text-slate-500 border border-slate-950/10 dark:border-white/5">↑↓</kbd>
                                    NAVIGATE
                                </span>
                                <span className="flex items-center gap-3">
                                    <kbd className="px-2.5 py-1.5 bg-slate-950/10 dark:bg-white/5 rounded-xl text-[9px] font-mono text-slate-500 border border-slate-950/10 dark:border-white/5">ENTER</kbd>
                                    EXECUTE
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-black text-blue-500/80 uppercase tracking-[0.3em] italic">
                                <Zap size={14} className="animate-pulse" />
                                <span>SYSTEM_READY</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CommandPalette;


