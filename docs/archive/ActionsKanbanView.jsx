import React, { useState, useMemo } from 'react';
import {
  ListTodo, FolderKanban, Network, Plus, Check, Clock, Loader2,
  AlertCircle, Trash2, Edit3, ChevronDown, ChevronRight, Paperclip,
  Users, X, Save, Sparkles, PhoneCall, ArrowRight, ArrowLeft, Filter,
  Calendar, CheckCircle2, MoreVertical, ShieldAlert
} from 'lucide-react';

// ── INITIAL MOCK DATA ────────────────────────────────────────────────────────
const INITIAL_TASKS = [
  {
    id: 'act-101',
    title: 'Transmit signed encryption NDA to Vanguard Legal team',
    description: 'Elena confirmed on call #101 that compliance review begins Friday. Send via encrypted Signal or Proton.',
    status: 'pending',
    priority: 'urgent',
    contact_name: 'Elena Rostova',
    contact_company: 'Vanguard Aero',
    call_source: 'Call #101 (18m 42s)',
    call_date: '2026-10-28',
    due_date: '2026-10-30',
    tags: ['Legal', 'NDA', 'Security']
  },
  {
    id: 'act-102',
    title: 'Validate HP-Z2G3 gateway ping across tailnet failover',
    description: 'Ensure Tailscale Funnel ingress remains responsive if primary node drops offline.',
    status: 'in_progress',
    priority: 'high',
    contact_name: 'Marcus Vance',
    contact_company: 'Apex Core',
    call_source: 'Call #100 (14m 19s)',
    call_date: '2026-10-26',
    due_date: '2026-10-31',
    tags: ['DevOps', 'Tailscale', 'Hardware']
  },
  {
    id: 'act-103',
    title: 'Benchmark Gemini 2.5 Flash token speed against Whisper local',
    description: 'Dr. Thorne recommended testing run_in_executor offloading to measure event loop unblocking delta.',
    status: 'in_progress',
    priority: 'high',
    contact_name: 'Dr. Aris Thorne',
    contact_company: 'Hyperion AI',
    call_source: 'Call #099 (22m 05s)',
    call_date: '2026-10-27',
    due_date: '2026-11-01',
    tags: ['AI Engine', 'Gemini', 'Benchmarking']
  },
  {
    id: 'act-104',
    title: 'Send updated executive deck before November capital review',
    description: 'Include multi-node architecture diagram and offline ACR ingestion benchmarks.',
    status: 'pending',
    priority: 'medium',
    contact_name: 'Sophia Sterling',
    contact_company: 'Sterling & Croft',
    call_source: 'Call #082 (09m 11s)',
    call_date: '2026-10-12',
    due_date: '2026-11-04',
    tags: ['Deck', 'Investor', 'Roadmap']
  },
  {
    id: 'act-105',
    title: 'Schedule dual-channel ACR audio telemetry test',
    description: 'Verified test completed on Android client; stereo channel split confirmed.',
    status: 'completed',
    priority: 'high',
    contact_name: 'Elena Rostova',
    contact_company: 'Vanguard Aero',
    call_source: 'Call #098 (34m 10s)',
    call_date: '2026-10-21',
    due_date: '2026-10-22',
    tags: ['ACR Phone', 'Audio', 'Tested']
  },
  {
    id: 'act-106',
    title: 'Refactor Whisper API schema to match OpenAI audio format',
    description: 'Ensured multipart/form-data audio uploads match standard Whisper specs.',
    status: 'completed',
    priority: 'urgent',
    contact_name: 'Marcus Vance',
    contact_company: 'Apex Core',
    call_source: 'System Audit',
    call_date: '2026-10-20',
    due_date: '2026-10-20',
    tags: ['FastAPI', 'Whisper']
  }
];

export default function ActionsKanbanView() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list' | 'canvas'
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // New task form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('high');
  const [newContact, setNewContact] = useState('Elena Rostova');

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchPri = priorityFilter === 'ALL' || t.priority.toLowerCase() === priorityFilter.toLowerCase();
      return matchSearch && matchPri;
    });
  }, [tasks, searchTerm, priorityFilter]);

  // Tasks grouped by status
  const pendingTasks = useMemo(() => filteredTasks.filter(t => t.status === 'pending'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter(t => t.status === 'in_progress'), [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter(t => t.status === 'completed'), [filteredTasks]);

  // Status transitions
  const advanceTask = (taskId) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        if (t.status === 'pending') {
          triggerToast(`Moved "${t.title.slice(0, 24)}..." to In Progress`);
          return { ...t, status: 'in_progress' };
        }
        if (t.status === 'in_progress') {
          triggerToast(`Resolved "${t.title.slice(0, 24)}..."`);
          return { ...t, status: 'completed' };
        }
      }
      return t;
    }));
  };

  const regressedTask = (taskId) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        if (t.status === 'completed') return { ...t, status: 'in_progress' };
        if (t.status === 'in_progress') return { ...t, status: 'pending' };
      }
      return t;
    }));
  };

  const deleteTask = (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    triggerToast('Action item purged');
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask = {
      id: `act-${Date.now().toString().slice(-4)}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Manual executive action item',
      status: 'pending',
      priority: newPriority,
      contact_name: newContact,
      contact_company: 'Horizon Ecosystem',
      call_source: 'Manual Executive Note',
      call_date: new Date().toISOString().split('T')[0],
      due_date: '2026-11-05',
      tags: ['Manual', newPriority.toUpperCase()]
    };

    setTasks([newTask, ...tasks]);
    setNewTitle('');
    setNewDesc('');
    setShowAddModal(false);
    triggerToast('New deliverable registered');
  };

  const getPriorityBadge = (p) => {
    switch (p.toLowerCase()) {
      case 'urgent':
        return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
      case 'high':
        return 'text-[#E8A656] border-[#E8A656]/40 bg-[#E8A656]/10';
      case 'medium':
        return 'text-amber-400 border-amber-400/40 bg-amber-400/10';
      default:
        return 'text-stone-400 border-stone-500/40 bg-stone-500/10';
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0D0B] text-stone-200 font-sans p-4 md:p-8 selection:bg-[#E8A656]/30">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#161512] border border-[#E8A656]/60 text-white px-5 py-3 rounded-xl shadow-2xl shadow-black/80">
          <Sparkles className="w-4 h-4 text-[#E8A656] animate-pulse" />
          <span className="text-xs font-mono">{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#E8A656] animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-[#E8A656] uppercase">
              PROJECT HORIZON PRM • WORKFLOW
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Action <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8A656] to-amber-200">Intelligence</span>
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            AI-extracted deliverables, autonomous task prioritization, and cross-entity relationship canvas.
          </p>
        </div>

        {/* Global Stats & Add Button */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-[#161512] border border-white/5 px-4 py-2 rounded-xl flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase font-mono text-stone-500">In Flight</div>
              <div className="text-lg font-bold font-mono text-white">{inProgressTasks.length + pendingTasks.length}</div>
            </div>
            <div className="w-[1px] h-7 bg-white/10" />
            <div>
              <div className="text-[10px] uppercase font-mono text-stone-500">Resolved</div>
              <div className="text-lg font-bold font-mono text-emerald-400">{completedTasks.length}</div>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E8A656] to-amber-600 text-stone-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition shadow-lg shadow-[#E8A656]/20"
          >
            <Plus className="w-4 h-4" />
            New Deliverable
          </button>
        </div>
      </div>

      {/* TOOLBAR: SEARCH, FILTERS & VIEW MODE */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search deliverables by title, person, tag, or call origin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-[#161512] border border-white/10 rounded-xl text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#E8A656]/60 transition"
          />
        </div>

        {/* Filter Priority Chips */}
        <div className="flex items-center gap-2">
          {['ALL', 'URGENT', 'HIGH', 'MEDIUM'].map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
                priorityFilter === p
                  ? 'bg-[#E8A656]/20 border border-[#E8A656] text-[#E8A656]'
                  : 'bg-[#161512] border border-white/5 text-stone-400 hover:text-stone-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-[#161512] border border-white/10 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
              viewMode === 'kanban' ? 'bg-[#E8A656] text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            Kanban
          </button>
          <button
            onClick={() => setViewMode('canvas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
              viewMode === 'canvas' ? 'bg-[#E8A656] text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Entity Canvas
          </button>
        </div>
      </div>

      {/* VIEW: KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COLUMN 1: PENDING */}
          <div className="flex flex-col bg-[#12110F] border border-white/5 rounded-2xl p-4 min-h-[500px]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#E8A656]" />
                <h3 className="font-mono text-xs uppercase tracking-widest text-stone-300 font-bold">
                  Pending Ingestion ({pendingTasks.length})
                </h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-amber-500/60" />
            </div>

            <div className="space-y-3 flex-1">
              {pendingTasks.map(task => renderTaskCard(task))}
              {pendingTasks.length === 0 && (
                <div className="text-center py-12 text-stone-600 text-xs font-mono">No pending items</div>
              )}
            </div>
          </div>

          {/* COLUMN 2: IN PROGRESS */}
          <div className="flex flex-col bg-[#12110F] border border-[#E8A656]/20 rounded-2xl p-4 min-h-[500px]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <h3 className="font-mono text-xs uppercase tracking-widest text-stone-300 font-bold">
                  Active Execution ({inProgressTasks.length})
                </h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </div>

            <div className="space-y-3 flex-1">
              {inProgressTasks.map(task => renderTaskCard(task))}
              {inProgressTasks.length === 0 && (
                <div className="text-center py-12 text-stone-600 text-xs font-mono">No tasks in progress</div>
              )}
            </div>
          </div>

          {/* COLUMN 3: RESOLVED */}
          <div className="flex flex-col bg-[#12110F] border border-white/5 rounded-2xl p-4 min-h-[500px]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-mono text-xs uppercase tracking-widest text-stone-300 font-bold">
                  Resolved Deliverables ({completedTasks.length})
                </h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>

            <div className="space-y-3 flex-1">
              {completedTasks.map(task => renderTaskCard(task))}
              {completedTasks.length === 0 && (
                <div className="text-center py-12 text-stone-600 text-xs font-mono">No resolved tasks</div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* VIEW: ENTITY CANVAS (GRAPH / NETWORK) */}
      {viewMode === 'canvas' && (
        <div className="max-w-7xl mx-auto bg-[#12110F] border border-white/10 rounded-2xl p-6 min-h-[560px] relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-mono text-xs text-[#E8A656]">
              <Network className="w-4 h-4" />
              <span>INTER-ENTITY DELIVERABLE CANVAS</span>
            </div>
            <span className="text-[11px] font-mono text-stone-500">Autonomous clustering by entity & urgency</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-auto">
            {['Elena Rostova', 'Marcus Vance', 'Dr. Aris Thorne'].map(name => {
              const entityTasks = tasks.filter(t => t.contact_name === name);
              return (
                <div key={name} className="bg-[#161512] border border-[#E8A656]/30 rounded-xl p-5 shadow-xl relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-stone-800 to-stone-900 border border-[#E8A656]/40 flex items-center justify-center font-mono font-bold text-[#E8A656]">
                      {name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{name}</h4>
                      <div className="text-[10px] font-mono text-stone-400">{entityTasks.length} linked commitments</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {entityTasks.map(t => (
                      <div key={t.id} className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-start justify-between gap-2 text-xs">
                        <span className={t.status === 'completed' ? 'line-through text-stone-500' : 'text-stone-300'}>
                          {t.title}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-white/5 text-[11px] font-mono text-stone-500 flex justify-between">
            <span>Visual node layout powered by Horizon Matrix Graph</span>
            <span>Real-time live sync: Active</span>
          </div>
        </div>
      )}

      {/* NEW DELIVERABLE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#141310] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E8A656]" />
                Register New Deliverable
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono uppercase text-stone-400 mb-1">Deliverable Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule preliminary briefing on dual-node latency..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#1C1A16] border border-white/10 rounded-xl text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#E8A656]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-stone-400 mb-1">Context & Details</label>
                <textarea
                  rows={3}
                  placeholder="Additional context or references extracted from calls..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1C1A16] border border-white/10 rounded-xl text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#E8A656]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-stone-400 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1C1A16] border border-white/10 rounded-xl text-xs text-stone-300 focus:outline-none"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-stone-400 mb-1">Assigned Contact</label>
                  <select
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1C1A16] border border-white/10 rounded-xl text-xs text-stone-300 focus:outline-none"
                  >
                    <option value="Elena Rostova">Elena Rostova</option>
                    <option value="Marcus Vance">Marcus Vance</option>
                    <option value="Dr. Aris Thorne">Dr. Aris Thorne</option>
                    <option value="Sophia Sterling">Sophia Sterling</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-stone-400 text-xs font-mono hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#E8A656] text-stone-950 font-bold text-xs uppercase tracking-wider hover:opacity-90 transition font-mono"
                >
                  Commit Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );

  // Helper render for task cards
  function renderTaskCard(task) {
    const isPending = task.status === 'pending';
    const isInProgress = task.status === 'in_progress';
    const isCompleted = task.status === 'completed';

    return (
      <div
        key={task.id}
        className="group bg-[#161512] border border-white/5 hover:border-[#E8A656]/30 rounded-xl p-4 transition shadow-md flex flex-col justify-between gap-3"
      >
        <div>
          {/* Card Top: Priority badge & delete */}
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${getPriorityBadge(task.priority)}`}>
              {task.priority}
            </span>
            <button
              onClick={() => deleteTask(task.id)}
              className="text-stone-600 hover:text-rose-400 p-1 transition opacity-0 group-hover:opacity-100"
              title="Purge Task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title */}
          <h4 className={`text-xs font-bold leading-snug ${isCompleted ? 'line-through text-stone-500' : 'text-stone-200'}`}>
            {task.title}
          </h4>

          {/* Context Snippet */}
          <p className="text-[11px] text-stone-400 line-clamp-2 mt-1.5 leading-relaxed">
            {task.description}
          </p>
        </div>

        {/* Call Source & Contact */}
        <div className="space-y-1.5 pt-2 border-t border-white/5 text-[10px] font-mono text-stone-500">
          <div className="flex items-center justify-between">
            <span className="text-[#E8A656]">{task.contact_name}</span>
            <span>Due {task.due_date}</span>
          </div>
          <div className="flex items-center gap-1.5 text-stone-400">
            <PhoneCall className="w-3 h-3 text-stone-500" />
            <span className="truncate">{task.call_source}</span>
          </div>
        </div>

        {/* Advance / Regress Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          {isPending && <div />}
          {!isPending && (
            <button
              onClick={() => regressedTask(task.id)}
              className="flex items-center gap-1 text-[10px] font-mono text-stone-500 hover:text-stone-300 transition"
              title="Move backward"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          )}

          {!isCompleted && (
            <button
              onClick={() => advanceTask(task.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#E8A656]/10 hover:bg-[#E8A656]/20 border border-[#E8A656]/30 text-[#E8A656] text-[10px] font-mono transition ml-auto"
            >
              <span>{isInProgress ? 'Resolve' : 'Advance'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {isCompleted && (
            <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1 ml-auto">
              <Check className="w-3 h-3" /> Done
            </span>
          )}
        </div>
      </div>
    );
  }
}
