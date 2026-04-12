import React from 'react';
import { ExternalLink, Linkedin, Globe, Search } from 'lucide-react';
import { Contact } from '@/types';
import { cn } from '@/utils/ui';

interface OsintSignalsProps {
    contact: Contact;
    className?: string;
}

const OsintSignals: React.FC<OsintSignalsProps> = ({ contact, className }) => {
    const rawData = contact.raw_data as any;
    const urls = rawData?.urls || [];
    const orgs = rawData?.organizations || [];
    const bios = rawData?.biographies || [];

    const bioText = bios[0]?.value;

    // Extract professional info
    const primaryOrg = orgs.find((o: any) => o.metadata?.primary) || orgs[0];
    const jobTitle = primaryOrg?.title;
    const department = primaryOrg?.department;

    const fullName = contact.full_name || contact.name || `${contact.first_name} ${contact.last_name || ''}`;
    const organization = contact.organization || primaryOrg?.name || '';

    const dorkingLinks = [
        {
            label: 'LinkedIn Discovery',
            icon: <Linkedin size={14} />,
            url: `https://www.google.com/search?q=site:linkedin.com/in+"${fullName}"+"${organization}"`,
            color: 'bg-blue-500/10 text-blue-600 border-blue-200'
        },
        {
            label: 'Corporate Signal',
            icon: <Globe size={14} />,
            url: `https://www.google.com/search?q="${organization}"+news+OR+press+release`,
            color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200'
        },
        {
            label: 'Digital Footprint',
            icon: <Search size={14} />,
            url: `https://www.google.com/search?q="${fullName}"+OR+"${contact.email || ''}"`,
            color: 'bg-slate-500/10 text-slate-600 border-slate-200'
        }
    ];

    return (
        <div className={cn("space-y-4", className)}>
            {(jobTitle || department) && (
                <div className="p-3 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Professional Context</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {jobTitle}{department ? ` • ${department}` : ''}
                    </p>
                    {bioText && (
                        <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-2 leading-relaxed">
                            "{bioText}"
                        </p>
                    )}
                </div>
            )}

            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Intelligence Signals</h3>

            <div className="grid grid-cols-1 gap-2">
                {/* Existing URLs from Google */}
                {urls.map((link: any, idx: number) => (
                    <a
                        key={idx}
                        href={link.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all group shadow-sm"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                                {link.value.includes('linkedin.com') ? <Linkedin size={14} /> : <ExternalLink size={14} />}
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{link.type || 'Profile'}</p>
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{link.value}</p>
                            </div>
                        </div>
                        <ExternalLink size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </a>
                ))}

                {/* Automated Dorking Triggers */}
                {dorkingLinks.map((dork, idx) => (
                    <a
                        key={`dork-${idx}`}
                        href={dork.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                            "flex items-center gap-3 p-3 border rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]",
                            dork.color
                        )}
                    >
                        {dork.icon}
                        <span className="text-xs font-black uppercase tracking-widest">{dork.label}</span>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default OsintSignals;
