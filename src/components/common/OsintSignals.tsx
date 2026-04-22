import React from 'react';
import { ExternalLink, Linkedin, Globe, Search, Phone, Mail, MapPin } from 'lucide-react';
import { Contact } from '@/types';
import { cn } from '@/utils/ui';

interface OsintSignalsProps {
    contact: Contact;
    className?: string;
}

const OsintSignals: React.FC<OsintSignalsProps> = ({ contact, className }) => {
    const rd = (contact.raw_data as any) || {};
    const orgs = (rd.organizations || []) as any[];
    const bios = (rd.biographies || []) as any[];
    const phones = (rd.phoneNumbers || []) as any[];
    const emails = (rd.emailAddresses || []) as any[];
    const addresses = (rd.addresses || []) as any[];

    const bioText = bios[0]?.value;
    const primaryOrg = orgs.find(o => o?.metadata?.primary) || orgs[0];
    const jobTitle = primaryOrg?.title;
    const department = primaryOrg?.department;

    const fullName = contact.full_name || `${contact.first_name} ${contact.last_name || ''}`.trim();
    const organization = contact.organization || primaryOrg?.name || '';
    const primaryEmail = contact.email || emails[0]?.value || '';
    const primaryPhone = contact.phone || phones[0]?.value || '';
    const primaryAddress = addresses[0]?.formattedValue || '';

    const dorkingLinks = [
        {
            label: 'LinkedIn Discovery',
            icon: <Linkedin size={14} />,
            url: `https://www.google.com/search?q=site:linkedin.com/in+"${fullName}"${organization ? `+"${organization}"` : ''}`,
            color: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900/40',
        },
        {
            label: 'Corporate Signal',
            icon: <Globe size={14} />,
            url: `https://www.google.com/search?q="${organization || fullName}"+news+OR+"press release"`,
            color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-900/40',
        },
        {
            label: 'Digital Footprint',
            icon: <Search size={14} />,
            url: `https://www.google.com/search?q="${fullName}"${primaryEmail ? `+OR+"${primaryEmail}"` : ''}`,
            color: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-700',
        },
        ...(primaryPhone ? [{
            label: 'Phone Lookup',
            icon: <Phone size={14} />,
            url: `https://www.google.com/search?q="${primaryPhone}"+OR+"${primaryPhone.replace(/\D/g, '')}"`,
            color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900/40',
        }] : []),
        ...(primaryEmail ? [{
            label: 'Email Footprint',
            icon: <Mail size={14} />,
            url: `https://www.google.com/search?q="${primaryEmail}"`,
            color: 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-900/40',
        }] : []),
        ...(primaryAddress ? [{
            label: 'Address Lookup',
            icon: <MapPin size={14} />,
            url: `https://www.google.com/maps/search/${encodeURIComponent(primaryAddress)}`,
            color: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900/40',
        }] : []),
    ];

    return (
        <div className={cn("space-y-4", className)}>
            {(jobTitle || department || bioText) && (
                <div className="p-3 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Professional Context</p>
                    {(jobTitle || department) && (
                        <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                            {jobTitle}{department ? ` • ${department}` : ''}
                        </p>
                    )}
                    {bioText && (
                        <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-3 leading-relaxed">
                            "{bioText}"
                        </p>
                    )}
                </div>
            )}

            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Intelligence Signals</h3>

            <div className="grid grid-cols-1 gap-2">
                {dorkingLinks.map((dork, idx) => (
                    <a
                        key={idx}
                        href={dork.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                            "flex items-center gap-3 p-3 border rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98]",
                            dork.color
                        )}
                    >
                        {dork.icon}
                        <span className="text-xs font-black uppercase tracking-widest">{dork.label}</span>
                        <ExternalLink size={11} className="ml-auto opacity-50" />
                    </a>
                ))}
            </div>

            {/* All phone numbers for quick dial */}
            {phones.length > 1 && (
                <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">All Numbers</h4>
                    <div className="space-y-1">
                        {phones.map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg">
                                <span className="text-slate-500 uppercase text-[10px] font-bold">{p.type || 'Phone'}</span>
                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{p.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All emails */}
            {emails.length > 1 && (
                <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">All Emails</h4>
                    <div className="space-y-1">
                        {emails.map((e: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg">
                                <span className="text-slate-500 uppercase text-[10px] font-bold">{e.type || 'Email'}</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{e.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OsintSignals;
