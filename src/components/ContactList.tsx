
import React, { useState, useMemo } from 'react';
import { Contact } from '@/types';
import { Search, Phone, Mail, Clock, ArrowUpDown, Users, Star, ImagePlus } from 'lucide-react';
import UnifiedContactDrawer from '@/components/common/UnifiedContactDrawer';
import { GoogleSyncButton } from '@/components/common/GoogleSyncButton';
import { useContacts, useToggleFavorite, useCalls } from '@/hooks/useHorizonData';
import { api } from '@/services/apiClient';

interface ContactListProps {
    // No props needed as we use the hook directly
}

type SortOption = 'alpha' | 'recent' | 'stats';

const ContactList: React.FC<ContactListProps> = () => {
    const { data: contacts = [] } = useContacts();
    const { data: calls = [] } = useCalls();
    const { mutate: toggleFavorite } = useToggleFavorite();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('alpha');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    // Photo enrichment state
    const [enrichingId, setEnrichingId] = useState<string | null>(null);

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
        let result = contacts.filter(contact => {
            const fullName = `${contact.first_name} ${contact.last_name || ''}`.toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            return fullName.includes(searchLower) || (contact.phone && contact.phone.includes(searchTerm));
        });

        return result.sort((a, b) => {
            switch (sortBy) {
                case 'alpha':
                    const nameA = `${a.first_name} ${a.last_name || ''}`;
                    const nameB = `${b.first_name} ${b.last_name || ''}`;
                    return nameA.localeCompare(nameB);
                case 'recent':
                    return new Date(b.last_contact_at || 0).getTime() - new Date(a.last_contact_at || 0).getTime();
                case 'stats':
                    return (b.health_score || 0) - (a.health_score || 0);
                default:
                    return 0;
            }
        });
    }, [contacts, searchTerm, sortBy]);

    const sortLabels: Record<SortOption, string> = {
        alpha: 'Alphabetical',
        recent: 'Most Recent',
        stats: 'Total Calls',
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Contacts</h2>
                    <p className="text-slate-500 dark:text-slate-400">Synced from Google Contacts.</p>
                </div>
                <div className="flex items-center gap-2">
                    <GoogleSyncButton userId="8f9bd918-48a2-7da2-2e4d-1de095ad5631" />
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {/* Sort Dropdown Trigger inside Search/Filter area */}
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 transition-colors"
                            title="Sort Options"
                        >
                            <ArrowUpDown size={16} />
                        </button>

                        {/* Dropdown Menu */}
                        {showSortMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-2 space-y-1">
                                    {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => {
                                                setSortBy(option);
                                                setShowSortMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${sortBy === option
                                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {sortLabels[option]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedContacts.length === 0 ? (
                    <div className="col-span-full card p-16 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400 mb-4">
                            <Users size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                            {searchTerm ? 'No matches found' : 'No contacts yet'}
                        </h3>
                        <p className="text-slate-400 text-sm max-w-sm mx-auto">
                            {searchTerm
                                ? `No contacts match "${searchTerm}". Try a different search.`
                                : 'Contacts are synced automatically from Google Contacts when calls are processed.'
                            }
                        </p>
                    </div>
                ) : (
                    filteredAndSortedContacts.map((contact) => {
                        const health = contact.health_score || 0;
                        const isStale = contact.last_contact_at &&
                            (new Date().getTime() - new Date(contact.last_contact_at).getTime() > 30 * 24 * 60 * 60 * 1000);

                        const healthColorClass =
                            health >= 80 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30' :
                                health >= 40 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30' :
                                    health === 0 ? 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' :
                                        'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30';

                        // Detect if the name is actually an email address
                        const isEmail = (s: string) => s?.includes('@');
                        const displayLetter = isEmail(contact.first_name) ? '✉' : contact.first_name?.charAt(0) || '?';

                        return (
                            <div key={contact.id} onClick={() => setSelectedContact(contact)} className="card card-interactive p-6 cursor-pointer group relative overflow-hidden">
                                {isStale && (
                                    <div className="absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 bg-rose-500/10 rotate-45 pointer-events-none" title="Relationship needs attention" />
                                )}

                                <div className="flex items-start justify-between mb-4">
                                    <div className="relative w-12 h-12">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center font-bold text-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 transition-all overflow-hidden ring-2 ring-transparent group-hover:ring-blue-500/20">
                                            {contact.photo_url ? (
                                                <img src={contact.photo_url} alt={contact.first_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                                <span className="text-lg">{displayLetter}</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => handleEnrichPhotos(e, contact)}
                                            disabled={enrichingId === contact.id}
                                            className="absolute -bottom-2 -right-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity disabled:bg-slate-400"
                                            title="Find Photos (OSINT)"
                                        >
                                            <ImagePlus size={12} className={enrichingId === contact.id ? "animate-pulse" : ""} />
                                        </button>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(contact.id);
                                            }}
                                            className={`p-1.5 rounded-full transition-colors ${contact.is_favorite ? 'text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-slate-300 dark:text-slate-600 hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            title={contact.is_favorite ? "Unfavorite" : "Favorite"}
                                        >
                                            <Star size={18} fill={contact.is_favorite ? "currentColor" : "none"} />
                                        </button>

                                        <div className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg border ${healthColorClass} animate-in fade-in duration-300`}>
                                            {health === 0 ? 'New' : (!contact.is_favorite ? 'Active' : `${health}% Health`)}
                                        </div>
                                    </div>
                                </div>


                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                    {contact.first_name} {contact.last_name}
                                    {isStale && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                                </h3>

                                {
                                    contact.organization && (
                                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-4">{contact.organization}</p>
                                    )
                                }

                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                                        <div className="w-5 h-5 rounded-md bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                                            <Phone size={12} className="text-slate-400" />
                                        </div>
                                        <span className="font-medium">{contact.phone || 'No phone'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                                        <div className="w-5 h-5 rounded-md bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                                            <Mail size={12} className="text-slate-400" />
                                        </div>
                                        <span className="font-medium truncate max-w-[180px]">{contact.email || 'No email'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-400 text-xs mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                                        <Clock size={12} />
                                        <span className={isStale ? 'text-rose-500 font-medium' : ''}>
                                            {contact.last_contact_at ? `Last contacted ${new Date(contact.last_contact_at).toLocaleDateString()}` : 'No interaction yet'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Unified Contact Drawer */}
            {
                selectedContact && (
                    <UnifiedContactDrawer
                        contactId={selectedContact.id}
                        contactName={`${selectedContact.first_name} ${selectedContact.last_name || ''}`.trim()}
                        contacts={contacts}
                        calls={calls}
                        onClose={() => setSelectedContact(null)}
                    />
                )
            }
        </div >
    );
};

export default ContactList;
