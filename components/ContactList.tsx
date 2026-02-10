
import React, { useState } from 'react';
import { Contact } from '../types';
import { ICONS } from '../constants';
import { useHistory } from '../context/HistoryContext';

interface ContactListProps {
  contacts: Contact[];
}

const ContactList: React.FC<ContactListProps> = ({ contacts }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { addHistoryItem } = useHistory();

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkAction = (action: string) => {
    addHistoryItem(`Bulk ${action} on Contacts`, `Modified ${selectedIds.size} contacts`);
    setSelectedIds(new Set());
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Resolved Contacts</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Directly synced from Google People API for name resolution.</p>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {ICONS.Search}
          </span>
          <input 
            type="text" 
            placeholder="Search contacts..." 
            className="w-full md:w-64 pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition outline-none text-sm text-slate-900 dark:text-white"
          />
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
              <th className="w-10 px-6 py-4"></th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Organization</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Activity</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Last Call</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {contacts.map((contact) => (
              <tr 
                key={contact.id} 
                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition cursor-default ${selectedIds.has(contact.id) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                onClick={() => toggleSelect(contact.id)}
              >
                <td className="px-6 py-5">
                   <div 
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                      selectedIds.has(contact.id)
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {selectedIds.has(contact.id) && ICONS.Check}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
                      {getInitials(contact.name)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{contact.name || "Unknown"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{contact.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{contact.organization || '—'}</span>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{contact.totalCalls}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">interactions</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {contact.lastContacted 
                      ? new Date(contact.lastContacted).toLocaleDateString([], { month: 'short', day: 'numeric' })
                      : 'Never'}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <button className="p-2 text-slate-400 hover:text-blue-600 transition">
                    {ICONS.Chevron}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

       {/* Bulk Action Bar */}
       {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-6 z-50 animate-in slide-in-from-bottom-10">
          <div className="font-bold text-sm">
            {selectedIds.size} Selected
          </div>
          <div className="h-4 w-px bg-white/20"></div>
          <button onClick={() => handleBulkAction('Export')} className="hover:text-blue-300 dark:hover:text-blue-200 transition text-sm font-medium">Export</button>
          <button onClick={() => handleBulkAction('Merge')} className="hover:text-blue-300 dark:hover:text-blue-200 transition text-sm font-medium">Merge</button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-2 p-1 hover:bg-white/10 rounded-full">×</button>
        </div>
      )}
    </div>
  );
};

export default ContactList;
