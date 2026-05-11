import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, PhoneCall, RefreshCw, ListTodo } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { useSyncGoogleContacts } from '../../hooks/useHorizonData';

const QuickActionsWidget: React.FC = () => {
  const navigate = useNavigate();
  const syncContacts = useSyncGoogleContacts();

  const handleSync = async () => {
    const id = toast.loading('Syncing Google Contacts...');
    try {
      const token = localStorage.getItem('google_access_token') || '';
      await syncContacts.mutateAsync({ userId: 'default', accessToken: token });
      toast.success('Sync complete', { id });
    } catch (e: any) {
      toast.error(`Sync failed: ${e.message}`, { id });
    }
  };

  const actions = [
    {
      icon: RefreshCw,
      label: 'Sync Google',
      color: 'emerald' as const,
      action: handleSync,
      loading: syncContacts.isPending,
    },
    {
      icon: PhoneCall,
      label: 'Call Log',
      color: 'blue' as const,
      action: () => navigate('/calls'),
    },
    {
      icon: Users,
      label: 'Contacts',
      color: 'blue' as const,
      action: () => navigate('/contacts'),
    },
    {
      icon: ListTodo,
      label: 'Actions',
      color: 'purple' as const,
      action: () => navigate('/actions'),
    },
  ];

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-lg">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.action}
            disabled={a.loading}
            className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 active:scale-95 transition-transform duration-100 text-left disabled:opacity-60"
          >
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                a.color === 'emerald' && 'bg-emerald-500/10 text-emerald-500',
                a.color === 'blue' && 'bg-blue-500/10 text-blue-500',
                a.color === 'purple' && 'bg-purple-500/10 text-purple-500',
              )}
            >
              <a.icon size={18} className={a.loading ? 'animate-spin' : undefined} />
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActionsWidget;
