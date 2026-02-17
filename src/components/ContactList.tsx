
import React, { useState, useMemo } from 'react';
import { Contact } from '@/types';
import { ICONS } from '@/constants';
import { Search, Phone, Mail, Clock, ArrowUpDown } from 'lucide-react';

interface ContactListProps {
    contacts: Contact[];
}

type SortOption = 'alpha' | 'recent' | 'stats';

const ContactList: React.FC<ContactListProps> = ({ contacts }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('alpha');
    const [showSortMenu, setShowSortMenu] = useState(false);

    const filteredAndSortedContacts = useMemo(() => {
        const result = contacts.filter(contact =>
            contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.phone.includes(searchTerm)
        );

        return result.sort((a, b) => {
            switch (sortBy) {
                case 'alpha':
                    return a.name.localeCompare(b.name);
                case 'recent':
                    return new Date(b.lastContacted).getTime() - new Date(a.lastContacted).getTime();
                case 'stats':
                    return (b.totalCalls || 0) - (a.totalCalls || 0);
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
                    <div className="col-span-full p-12 text-center text-slate-400">
                        {ICONS.Contacts}
                        <p className="mt-2">No contacts found.</p>
                    </div>
                ) : (
                    filteredAndSortedContacts.map((contact) => (
                        <div key={contact.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow group relative">
                            {/* Initials Avatar */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center font-bold text-xl">
                                    {contact.name.charAt(0)}
                                </div>
                                <div className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">
                                    {contact.totalCalls} Calls
                                </div>
                            </div>

                            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">
                                {contact.name}
                            </h3>

                            <div className="space-y-2 mt-4">
                                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                                    <Phone size={14} />
                                    <span>{contact.phone}</span>
                                </div>
                                {contact.email && (
                                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                                        <Mail size={14} />
                                        <span>{contact.email}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-slate-400 text-xs mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Clock size={12} />
                                    <span>Last contacted: {new Date(contact.lastContacted).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ContactList;
