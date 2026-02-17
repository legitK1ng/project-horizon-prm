import React, { useState, useRef } from 'react';
import { Mail, Phone, User, Edit2 } from 'lucide-react';
import { searchPerson } from '@/services/apiService';
import { PersonData } from '@/types';
import EditContactModal from './EditContactModal';

interface ContactHoverCardProps {
    contactName: string;
    phoneNumber?: string;
    children: React.ReactNode;
}

// Simple in-memory cache to avoid repeated API calls in the same session
const contactCache: Record<string, PersonData> = {};

const ContactHoverCard: React.FC<ContactHoverCardProps> = ({ contactName, phoneNumber, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [data, setData] = useState<PersonData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const timeoutRef = useRef<NodeJS.Timeout>();
    const containerRef = useRef<HTMLDivElement>(null);

    const query = phoneNumber || contactName;

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
            loadData();
        }, 600); // 600ms delay to prevent accidental triggers
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(false);
    };

    const loadData = async () => {
        if (!query || data) return;

        // Check cache first
        if (contactCache[query]) {
            setData(contactCache[query]);
            return;
        }

        setLoading(true);
        try {
            const result = await searchPerson(query);
            contactCache[query] = result;
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = (updatedPerson: PersonData) => {
        setData(updatedPerson);
        if (query) {
            contactCache[query] = updatedPerson;
        }
    };

    return (
        <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            ref={containerRef}
        >
            {children}

            {isVisible && (
                <div className="absolute z-50 left-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="shrink-0">
                            {data?.photoUrl ? (
                                <img
                                    src={data.photoUrl}
                                    alt={data.name || contactName}
                                    className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <User size={20} />
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate pr-2">
                                    {data?.name || contactName}
                                </h4>
                                {data?.found && (
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        title="Edit Contact"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                )}
                            </div>

                            {(data?.title || data?.organization) && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">
                                    {data?.title} {data?.title && data?.organization && 'at'} {data?.organization}
                                </p>
                            )}

                            {loading ? (
                                <div className="space-y-2 mt-2">
                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-3/4 animate-pulse" />
                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-1/2 animate-pulse" />
                                </div>
                            ) : (
                                <div className="space-y-1.5 mt-2">
                                    {data?.email && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                            <Mail size={12} className="shrink-0 opacity-70" />
                                            <a href={`mailto:${data.email}`} className="hover:text-blue-500 truncate">
                                                {data.email}
                                            </a>
                                        </div>
                                    )}
                                    {phoneNumber && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                            <Phone size={12} className="shrink-0 opacity-70" />
                                            <span>{phoneNumber}</span>
                                        </div>
                                    )}
                                    {!data?.found && !loading && (
                                        <div className="text-[10px] text-slate-400 italic">
                                            No detailed profile found.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {data && (
                <EditContactModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    person={data}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default ContactHoverCard;
