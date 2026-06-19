import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Contact } from '@/types';
import { Search, Phone, Mail, Clock, ArrowUpDown, Users, Star, ImagePlus, UserPlus, Filter } from 'lucide-react';
import UnifiedContactDrawer from '@/components/common/UnifiedContactDrawer';
import { GoogleSyncButton } from '@/components/common/GoogleSyncButton';
import { useToggleFavorite, useCalls } from '@/hooks/useHorizonData';
import { api } from '@/services/apiClient';
import { cn } from '@/lib/utils';
import Skeleton from './common/Skeleton';
import PremiumButton from './common/PremiumButton';
import GlassCard from './common/GlassCard';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useVirtualizer } from '@tanstack/react-virtual';

type SortOption = 'alpha' | 'recent' | 'stats';

const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: 'spring', stiffness: 120, damping: 14 } as const
    },
};

const ContactList: React.FC = () => {
    const rawContacts = useLiveQuery(() => db.contacts.toArray());
    const contactsLoading = rawContacts === undefined;
    const contacts = useMemo(() => rawContacts || [], [rawContacts]);
    
    const { data: calls = [] } = useCalls();
    const { mutate: toggleFavorite } = useToggleFavorite();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('alpha');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    // Photo enrichment state
    const [enrichingId, setEnrichingId] = useState<string | null>(null);

    // Window width for grid virtualization
    const [columns, setColumns] = useState(1);
    const parentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) setColumns(3); // lg
            else if (window.innerWidth >= 768) setColumns(2); // md
            else setColumns(1); // mobile
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleEnrichPhotos = async (e: React.MouseEvent, contact: Contact) => {
        e.stopPropagation();
        if (enrichingId) return;
        setEnrichingId(contact.id);
        try {
            // First trigger the OSINT pipeline
            await api.triggerEnrichment(contact.id);
            // Then fetch the resulting photos
            const photos = await api.getContactPhotos(contact.id);
            if (photos && photos.length > 0) {
                // Just cycle to the first new photo that isn't the current one (if available)
                const nextPhoto = photos.find(p => p !== contact.photo_url) || photos[0];
                if (nextPhoto) {
                    await api.setContactPhoto(contact.id, nextPhoto);
                }
            }
        } finally {
            setEnrichingId(null);
        }
    };

    const filteredAndSortedContacts = useMemo(() => {
        const result = contacts.filter(contact => {
            const fullName = `${contact.first_name} ${contact.last_name || ''}`.toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            return fullName.includes(searchLower) || (contact.phone && contact.phone.includes(searchTerm));
        });

        return result.sort((a, b) => {
            switch (sortBy) {
                case 'alpha': {
                    const nameA = `${a.first_name} ${a.last_name || ''}`;
                    const nameB = `${b.first_name} ${b.last_name || ''}`;
                    return nameA.localeCompare(nameB);
                }
                case 'recent':
                    return new Date(b.last_contact_at || 0).getTime() - new Date(a.last_contact_at || 0).getTime();
                case 'stats':
                    return (b.health_score || 0) - (a.health_score || 0);
                default:
                    return 0;
            }
        });
    }, [contacts, searchTerm, sortBy]);

    const rows = useMemo(() => {
        const chunked = [];
        for (let i = 0; i < filteredAndSortedContacts.length; i += columns) {
            chunked.push(filteredAndSortedContacts.slice(i, i + columns));
        }
        return chunked;
    }, [filteredAndSortedContacts, columns]);

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 280, // estimated height of contact card + gap
        overscan: 5,
    });

    const sortLabels: Record<SortOption, string> = {
        alpha: 'Alphabetical',
        recent: 'Most Recent',
        stats: 'Health Score',
    };

    if (contactsLoading) {
        return (
            <div className="space-y-8 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <Skeleton variant="text" className="h-12 w-64" />
                        <Skeleton variant="text" className="h-4 w-48" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-12 w-48 rounded-2xl" />
                        <Skeleton className="h-12 w-64 rounded-2xl" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-64 rounded-[2rem]" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12 h-[calc(100vh-6rem)] flex flex-col">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <h2 className="text-4xl lg:text-6xl font-black tracking-tighter text-slate-900 dark:text-white mb-2 uppercase italic">
                        Intelligence <span className="text-blue-600 dark:text-blue-400">Directory</span>
                    </h2>
                    <p className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] opacity-70">
                        Enterprise-grade relationship graph management.
                    </p>
                </motion.div>
                
                <motion.div 
                    className="flex flex-wrap items-center gap-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <GoogleSyncButton userId="default" />
                    <PremiumButton variant="outline" size="lg">
                        <UserPlus size={18} className="mr-2" />
                        New Entity
                    </PremiumButton>
                </motion.div>
            </div>

            {/* Filter & Search Bar */}
            <GlassCard className="p-4 shrink-0">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search intelligence directory..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <PremiumButton 
                                variant="secondary" 
                                size="lg"
                                onClick={() => setShowSortMenu(!showSortMenu)}
                                className="min-w-[180px] justify-between"
                            >
                                <div className="flex items-center">
                                    <Filter size={16} className="mr-2 opacity-70" />
                                    <span>{sortLabels[sortBy]}</span>
                                </div>
                                <ArrowUpDown size={14} className="ml-2 opacity-50" />
                            </PremiumButton>

                            <AnimatePresence>
                                {showSortMenu && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-3 w-56 bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden backdrop-blur-xl"
                                    >
                                        <div className="p-2 space-y-1">
                                            {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                                                <button
                                                    key={option}
                                                    onClick={() => {
                                                        setSortBy(option);
                                                        setShowSortMenu(false);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 flex items-center justify-between",
                                                        sortBy === option
                                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    )}
                                                >
                                                    {sortLabels[option]}
                                                    {sortBy === option && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </GlassCard>

            <div 
                ref={parentRef} 
                className="flex-1 overflow-y-auto w-full pr-2 -mr-2"
            >
                {filteredAndSortedContacts.length === 0 ? (
                    <motion.div variants={itemVariants} className="col-span-full py-24 text-center">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-slate-400 mb-6">
                            <Users size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                            {searchTerm ? 'No intelligence found' : 'Directory empty'}
                        </h3>
                        <p className="text-slate-400 text-base max-w-sm mx-auto">
                            {searchTerm
                                ? `No entities match "${searchTerm}". Try broadening your search parameters.`
                                : 'Network nodes will appear here once ingested from external sources or added manually.'
                            }
                        </p>
                    </motion.div>
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const rowContacts = rows[virtualRow.index];
                            if (!rowContacts) return null;
                            return (
                                <div
                                    key={virtualRow.key}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                                        {rowContacts.map((contact) => {
                                            const health = contact.health_score || 0;
                                            const isStale = contact.last_contact_at &&
                                                (new Date().getTime() - new Date(contact.last_contact_at).getTime() > 30 * 24 * 60 * 60 * 1000);

                                            const healthColorClass =
                                                health >= 80 ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' :
                                                    health >= 40 ? 'text-amber-600 bg-amber-500/10 border-amber-500/20' :
                                                        health === 0 ? 'text-blue-600 bg-blue-500/10 border-blue-500/20' :
                                                            'text-rose-600 bg-rose-500/10 border-rose-500/20';

                                            const isEmail = (s: string) => s?.includes('@');
                                            const displayLetter = isEmail(contact.first_name) ? '✉' : contact.first_name?.charAt(0) || '?';

                                            return (
                                                <div
                                                    key={contact.id}
                                                    onClick={() => setSelectedContact(contact)}
                                                    className={cn(
                                                        "group relative p-6 cursor-pointer overflow-hidden rounded-[2.5rem] transition-all duration-500",
                                                        "glass-premium border border-white/10 dark:border-white/5",
                                                        "hover:shadow-glow hover:shadow-blue-500/20 hover:-translate-y-2 active:scale-[0.98]",
                                                        "h-64"
                                                    )}
                                                >
                                                    <div className="absolute inset-0 bg-carbon opacity-[0.03] dark:opacity-[0.05] -z-10" />
                                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                                                    
                                                    <div className="scanline absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none -z-10" />
                                                    <div className="flex items-start justify-between mb-6">
                                                        <div className="relative">
                                                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center font-bold text-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 overflow-hidden ring-4 ring-transparent group-hover:ring-blue-500/20">
                                                                {contact.photo_url ? (
                                                                    <img src={contact.photo_url} alt={contact.first_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                                                                ) : (
                                                                    <span className="text-2xl">{displayLetter}</span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleEnrichPhotos(e, contact)}
                                                                disabled={enrichingId === contact.id}
                                                                className="absolute -bottom-2 -right-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100 disabled:bg-slate-400 z-10"
                                                                title="Enrich Entity Photos"
                                                            >
                                                                <ImagePlus size={14} className={enrichingId === contact.id ? "animate-spin" : ""} />
                                                            </button>
                                                        </div>

                                                        <div className="flex flex-col items-end gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleFavorite(contact.id);
                                                                }}
                                                                className={cn(
                                                                    "p-2 rounded-xl transition-all duration-300",
                                                                    contact.is_favorite 
                                                                        ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' 
                                                                        : 'text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                )}
                                                            >
                                                                <Star size={20} fill={contact.is_favorite ? "currentColor" : "none"} />
                                                            </button>

                                                            <div className={cn(
                                                                "text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-full border shadow-sm transition-colors duration-500",
                                                                healthColorClass
                                                            )}>
                                                                {health === 0 ? 'NEONATE' : `${health}% HEALTH`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <h3 className="font-black text-2xl text-slate-900 dark:text-white tracking-tighter flex items-center gap-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase italic truncate max-w-full">
                                                            {contact.first_name} {contact.last_name}
                                                            {isStale && (
                                                                <motion.div 
                                                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} 
                                                                    transition={{ repeat: Infinity, duration: 2 }}
                                                                    className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-glow shadow-rose-500/50 flex-shrink-0" 
                                                                />
                                                            )}
                                                        </h3>
                                                        {contact.organization ? (
                                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] truncate">{contact.organization}</p>
                                                        ) : (
                                                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">Independent Entity</p>
                                                        )}
                                                    </div>

                                                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 space-y-3">
                                                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                                                            <Phone size={14} className="text-slate-300 dark:text-slate-600" />
                                                            <span className="font-semibold">{contact.phone || 'NO SECURE LINE'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                                                            <Mail size={14} className="text-slate-300 dark:text-slate-600" />
                                                            <span className="font-semibold truncate max-w-[180px]">{contact.email || 'NO DIGITAL INDEX'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                                            <Clock size={12} />
                                                            <span>
                                                                {contact.last_contact_at ? `T-${Math.floor((new Date().getTime() - new Date(contact.last_contact_at).getTime()) / (1000 * 60 * 60 * 24))} Days` : 'UNTRACKED'}
                                                            </span>
                                                        </div>
                                                        <div className="h-1 flex-1 mx-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div
                                                                style={{ width: `${health}%` }}
                                                                className={cn(
                                                                    "h-full rounded-full transition-[width] duration-700",
                                                                    health >= 80 ? 'bg-emerald-500' : health >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Unified Contact Drawer */}
            <AnimatePresence>
                {selectedContact && (
                    <UnifiedContactDrawer
                        contactId={selectedContact.id}
                        contactName={`${selectedContact.first_name} ${selectedContact.last_name || ''}`.trim()}
                        contacts={contacts}
                        calls={calls}
                        onClose={() => setSelectedContact(null)}
                    />
                )}
            </AnimatePresence>
        </div >
    );
};

export default ContactList;

