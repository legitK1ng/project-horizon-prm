
import React, { useState } from 'react';
import { useHistory } from '../context/HistoryContext';
import { ICONS } from '../constants';

const ActionsLog: React.FC = () => {
  const { history, togglePin, revertAction } = useHistory();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort: Pinned first, then by date descending
  const sortedHistory = [...history].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Sync Queue & Audit</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Track all system changes, edits, and automated processes.</p>
      </header>

      <div className="max-w-3xl space-y-4">
        {sortedHistory.map((item) => (
          <div 
            key={item.id}
            className={`group bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 ${
              item.pinned 
                ? 'border-blue-200 dark:border-blue-800 shadow-md shadow-blue-100 dark:shadow-none' 
                : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
            }`}
          >
            {/* Main Button Area */}
            <div className="flex">
              <div 
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="flex-1 p-5 cursor-pointer flex items-start space-x-4"
              >
                <div className={`mt-1 p-2 rounded-lg ${
                  item.pinned ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {ICONS.Actions}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500 uppercase">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                    {item.pinned && (
                      <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Pinned
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{item.label}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Pin Action */}
              <button 
                onClick={() => togglePin(item.id)}
                className="w-12 border-l border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                title={item.pinned ? "Unpin" : "Pin to top"}
              >
                {item.pinned ? ICONS.Unpin : ICONS.Pin}
              </button>
            </div>

            {/* Expanded Details */}
            {expandedId === item.id && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 p-5 animate-in slide-in-from-top-2">
                <div className="mb-4">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Change Detail</h5>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-600 dark:text-slate-300">
                    {`{\n  "actionId": "${item.id}",\n  "type": "USER_ACTION",\n  "description": "${item.description}"\n}`}
                  </div>
                </div>
                
                {item.revertable && (
                  <button 
                    onClick={() => revertAction(item.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 transition font-medium text-sm"
                  >
                    {ICONS.Undo}
                    <span>Revert Changes</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {history.length === 0 && (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <p>No actions recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionsLog;
