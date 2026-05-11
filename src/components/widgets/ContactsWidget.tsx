import React from 'react';
import { Users } from 'lucide-react';
import { useContacts } from '../../hooks/useHorizonData';
import { cn } from '../../lib/utils';

interface Props {
  onContactSelect: (id: string, name: string) => void;
}

const ContactsWidget: React.FC<Props> = ({ onContactSelect }) => {
  const { data: contacts, isLoading } = useContacts();

  const sorted = (contacts ?? [])
    .slice()
    .sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return (b.total_calls ?? 0) - (a.total_calls ?? 0);
    })
    .slice(0, 25);

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-lg">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">
        Top Contacts
      </h3>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-4">
          <Users size={24} className="text-slate-300 dark:text-slate-600 mx-auto mb-1" />
          <p className="text-xs text-slate-400 font-semibold">No contacts synced yet</p>
        </div>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-1"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {sorted.map((contact) => {
            const name = `${contact.first_name} ${contact.last_name ?? ''}`.trim();
            return (
              <button
                key={contact.id}
                onClick={() => onContactSelect(contact.id, name)}
                className="flex flex-col items-center gap-1.5 shrink-0 active:scale-90 transition-transform duration-100"
              >
                <div
                  className={cn(
                    'w-14 h-14 rounded-2xl overflow-hidden border-2',
                    contact.is_favorite
                      ? 'border-amber-400 shadow-md shadow-amber-200/50 dark:shadow-amber-900/30'
                      : 'border-slate-200 dark:border-slate-700',
                  )}
                >
                  {contact.photo_url ? (
                    <img
                      src={contact.photo_url}
                      alt={name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-black text-xl">
                      {contact.first_name[0]}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 w-14 text-center truncate">
                  {contact.first_name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContactsWidget;
