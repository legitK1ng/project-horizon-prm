
import React, { useState, useMemo } from 'react';
import { CallRecord } from '../types';
import { ICONS } from '../constants';
import SmartTextRenderer from './SmartTextRenderer';
import { useHistory } from '../context/HistoryContext';
import { PhoneCall } from 'lucide-react';

interface CallLogProps {
  calls: CallRecord[];
  onAddCall: (call: CallRecord) => void;
  onUpdateCalls: (calls: CallRecord[]) => void;
}

const CallLog: React.FC<CallLogProps> = ({ calls, onAddCall, onUpdateCalls }) => {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [filterTag, setFilterTag] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { addHistoryItem } = useHistory();

  // Extract all unique tags for filter
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    calls.forEach(c => c.executiveBrief?.tags.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [calls]);

  const filteredCalls = calls.filter(call => 
    !filterTag || call.executiveBrief?.tags.includes(filterTag)
  );

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkAction = (action: 'tag' | 'archive') => {
    if (action === 'archive') {
      const prevCalls = [...calls];
      // Simulate archive by filtering out (in a real app, status change)
      const newCalls = calls.filter(c => !selectedIds.has(c.id));
      onUpdateCalls(newCalls);
      
      addHistoryItem(
        `Bulk Archived ${selectedIds.size} Items`, 
        `Archived IDs: ${Array.from(selectedIds).join(', ')}`,
        () => onUpdateCalls(prevCalls) // Revert logic
      );
      setSelectedIds(new Set());
      setSelectedCall(null);
    }
  };

  const handleSmartTagClick = (tag: string) => {
    setFilterTag(tag);
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 relative h-full">
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Call Intelligence</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Comprehensive record of all analyzed communications.</p>
        </div>
        
        {/* Filter Dropdown */}
        <div className="flex items-center space-x-2">
          {filterTag && (
            <button 
              onClick={() => setFilterTag('')}
              className="text-xs font-bold text-rose-500 hover:underline"
            >
              Clear
            </button>
          )}
          <div className="relative group">
            <div className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              {ICONS.Filter}
              <span>{filterTag || 'Filter by Tag'}</span>
            </div>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl hidden group-hover:block z-20 p-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(tag)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-[calc(100vh-200px)]">
        {/* Left Column: List */}
        <div className={`space-y-4 lg:col-span-5 h-full overflow-y-auto pb-20 ${selectedCall ? 'hidden lg:block' : 'block'}`}>
          <div className="relative mb-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {ICONS.Search}
            </span>
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition outline-none text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-3">
            {filteredCalls.map((call) => (
              <div 
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className={`group relative p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                  selectedCall?.id === call.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' 
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
                }`}
              >
                {/* Bulk Checkbox */}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleSelect(call.id); }}
                  className={`absolute top-4 right-4 w-5 h-5 rounded border flex items-center justify-center transition-colors z-10 ${
                    selectedIds.has(call.id)
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 bg-white dark:bg-slate-800'
                  }`}
                >
                  {selectedIds.has(call.id) && ICONS.Check}
                </div>

                <div className="flex justify-between items-start pr-8">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      selectedCall?.id === call.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      {ICONS.Logs}
                    </div>
                    <div>
                      <h4 className="font-bold leading-tight">{call.contactName}</h4>
                      <p className={`text-xs ${selectedCall?.id === call.id ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                        {new Date(call.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    selectedCall?.id === call.id ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}>
                    {call.duration}
                  </div>
                </div>
                {call.executiveBrief && (
                  <div className={`mt-3 pt-3 border-t text-sm line-clamp-1 italic ${
                    selectedCall?.id === call.id ? 'border-white/20 text-white/80' : 'border-slate-50 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    "{call.executiveBrief.title}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Detail View */}
        <div className={`lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col ${!selectedCall ? 'hidden lg:flex items-center justify-center p-12' : 'flex'}`}>
          {selectedCall ? (
            <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setSelectedCall(null)}
                    className="lg:hidden p-2 text-slate-400 hover:text-slate-600"
                  >
                    ←
                  </button>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedCall.contactName}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedCall.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full flex items-center">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                    Analyzed
                  </span>
                </div>
              </div>

              {/* Content Scrollable Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-50/30 dark:bg-slate-950/30">
                {selectedCall.executiveBrief ? (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                      {selectedCall.executiveBrief.title}
                    </h2>
                    
                    <div className="mb-8">
                      <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Strategic Summary</h4>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg">
                        <SmartTextRenderer text={selectedCall.executiveBrief.summary} onTagClick={handleSmartTagClick} />
                      </p>
                    </div>

                    <div className="mb-8">
                      <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">Action Items</h4>
                      <ul className="space-y-4">
                        {selectedCall.executiveBrief.actionItems.map((item, idx) => (
                          <li key={idx} className="flex items-start group">
                            <span className="mt-1 mr-3 flex-shrink-0">{ICONS.Action}</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-400 transition">
                              <SmartTextRenderer text={item} onTagClick={handleSmartTagClick} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedCall.executiveBrief.tags.map((tag, idx) => (
                        <span 
                          key={idx} 
                          onClick={() => handleSmartTagClick(tag)}
                          className="flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          <span className="mr-1.5 opacity-60">#</span>
                          {tag.replace('#', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-20 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30 border-dashed">
                    <div className="text-center">
                      <div className="text-amber-500 mb-3 flex justify-center">{ICONS.Pending}</div>
                      <p className="text-amber-800 dark:text-amber-500 font-semibold">Processing Transcript...</p>
                      <p className="text-amber-600/70 dark:text-amber-500/70 text-sm">Gemini is synthesizing the executive brief.</p>
                    </div>
                  </div>
                )}

                {/* Raw Transcript Toggle */}
                <details className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <summary className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300 select-none">
                    <span>Raw Input Data</span>
                    <span className="group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-50 dark:border-slate-800">
                    <div className="font-mono text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                      <SmartTextRenderer text={selectedCall.rawTranscript} />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          ) : (
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-600">
                <PhoneCall size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Select a Conversation</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Choose a call from the log to view its strategic analysis and executive brief.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-6 z-50 animate-in slide-in-from-bottom-10">
          <div className="font-bold text-sm">
            {selectedIds.size} Selected
          </div>
          <div className="h-4 w-px bg-white/20"></div>
          <button className="hover:text-blue-300 dark:hover:text-blue-200 transition text-sm font-medium">Tag</button>
          <button className="hover:text-blue-300 dark:hover:text-blue-200 transition text-sm font-medium">Merge</button>
          <button 
            onClick={() => handleBulkAction('archive')}
            className="hover:text-rose-300 dark:hover:text-rose-200 transition text-sm font-medium"
          >
            Archive
          </button>
          <button 
            onClick={() => setSelectedIds(new Set())}
            className="ml-2 p-1 hover:bg-white/10 rounded-full"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default CallLog;
