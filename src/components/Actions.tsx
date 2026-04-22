/**
 * Horizon PRM — Actions Page
 * Items 11 (Tasks/Projects toggle), 12 (Canvas visualization)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ListTodo,
  FolderKanban,
  Network,
  Plus,
  Check,
  Clock,
  Loader2,
  AlertCircle,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Users,
  X,
  Save,
  Sparkles,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/utils/ui';
import { useActionsStore } from '@/store/appStore';
import { Task, Project, TaskStatus } from '@/types';
import { api } from '@/services/apiClient';
import { useTasks, useProjects } from '@/hooks/useHorizonData';

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.FC<any> }> = {
  pending:     { label: 'Pending',     color: 'text-slate-500 bg-slate-100 dark:bg-slate-800',               icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',               icon: Loader2 },
  completed:   { label: 'Done',        color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',      icon: Check },
  cancelled:   { label: 'Cancelled',   color: 'text-rose-500 bg-rose-100 dark:bg-rose-900/30',               icon: X },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    'border-l-slate-300',
  medium: 'border-l-amber-400',
  high:   'border-l-orange-500',
  urgent: 'border-l-rose-600',
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Tab Toggle ───────────────────────────────────────────────────────────────

type TabId = 'tasks' | 'projects' | 'canvas';

interface TabOption { id: TabId; label: string; icon: React.FC<any> }

const TABS: TabOption[] = [
  { id: 'tasks',    label: 'Tasks',    icon: ListTodo },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'canvas',   label: 'Canvas',   icon: Network },
];

// ── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onDelete }) => {
  const cfg = STATUS_CONFIG[task.status];
  const StatusIcon = cfg.icon;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800',
        'border-l-4 shadow-sm hover:shadow-md transition-all group',
        PRIORITY_COLOR[task.priority] || 'border-l-slate-300'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'font-semibold text-slate-900 dark:text-white text-sm leading-snug',
              task.status === 'completed' && 'line-through opacity-50'
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full', cfg.color)}>
              <StatusIcon size={10} className={task.status === 'in_progress' ? 'animate-spin' : ''} />
              {cfg.label}
            </span>
            {task.source === 'ai_generated' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <Sparkles size={10} /> AI
              </span>
            )}
            {task.due_date && (
              <span className="text-[11px] text-slate-400">
                Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.contact_name && (
              <span className="text-[11px] text-slate-400">→ {task.contact_name}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Quick status cycle */}
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            className="text-[11px] bg-slate-100 dark:bg-slate-800 border-0 rounded-lg px-2 py-1 cursor-pointer focus:ring-1 focus:ring-blue-500"
          >
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── New Task Form ────────────────────────────────────────────────────────────

interface NewTaskFormProps {
  onAdd: (task: Task) => void;
  onCancel: () => void;
}

const NewTaskForm: React.FC<NewTaskFormProps> = ({ onAdd, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      id: generateId(),
      title: title.trim(),
      description: description.trim() || null,
      status: 'pending',
      source: 'user',
      priority,
      due_date: dueDate || null,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Task title..."
        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)..."
        rows={2}
        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Task['priority'])}
          className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Tasks Panel ──────────────────────────────────────────────────────────────

const TasksPanel: React.FC = () => {
  const { tasks, addTask, updateTask, removeTask } = useActionsStore();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');

  const filtered = filterStatus === 'all' ? tasks : tasks.filter((t) => t.status === filterStatus);
  const counts: Record<string, number> = {
    all: tasks.length,
    ...Object.fromEntries(
      Object.keys(STATUS_CONFIG).map((s) => [s, tasks.filter((t) => t.status === s).length])
    ),
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    updateTask(id, { status, updated_at: new Date().toISOString() });
    try { await api.updateTask(id, { status }); } catch { /* optimistic — silently keep local state */ }
  };

  const handleDelete = async (id: string) => {
    removeTask(id);
    try { await api.deleteTask(id); } catch { /* already removed locally */ }
  };

  const handleAdd = async (task: Task) => {
    addTask(task);
    setShowForm(false);
    try {
      const saved = await api.createTask(task);
      updateTask(task.id, { id: saved.id });
    } catch { toast.error('Task saved locally only — backend unavailable.'); }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', ...Object.keys(STATUS_CONFIG)] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s as any)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              filterStatus === s
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
            )}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s as TaskStatus].label}
            <span className="ml-1.5 opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
        >
          <Plus size={14} /> New Task
        </button>
      </div>

      {showForm && <NewTaskForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />}

      {/* Task list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ListTodo size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No tasks yet.</p>
            <p className="text-xs mt-1">Add one above or let AI generate action items from call transcripts.</p>
          </div>
        ) : (
          filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ── Project Card ─────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project;
  onUpdate: (id: string, patch: Partial<Project>) => void;
  onDelete: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(project.notes || '');

  const completedTasks = (project.tasks || []).filter((t) => t.status === 'completed').length;
  const totalTasks = (project.tasks || []).length;

  const STATUS_BADGE: Record<string, string> = {
    active:    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    on_hold:   'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    completed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    archived:  'bg-slate-100 dark:bg-slate-800 text-slate-500',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
            <FolderKanban size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white truncate">{project.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', STATUS_BADGE[project.status])}>
                {project.status.replace('_', ' ')}
              </span>
              {totalTasks > 0 && (
                <span className="text-[11px] text-slate-400">
                  {completedTasks}/{totalTasks} tasks
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-5 space-y-5">
          {/* Progress bar */}
          {totalTasks > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{Math.round((completedTasks / totalTasks) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Status selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
            <select
              value={project.status}
              onChange={(e) => onUpdate(project.id, { status: e.target.value as Project['status'] })}
              className="text-xs bg-slate-100 dark:bg-slate-800 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Notes section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes</span>
              {!editingNotes ? (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                  <Edit3 size={11} /> Edit
                </button>
              ) : (
                <button
                  onClick={() => { onUpdate(project.id, { notes }); setEditingNotes(false); }}
                  className="text-xs text-emerald-500 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Save size={11} /> Save
                </button>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {notes || <span className="italic opacity-50">No notes yet.</span>}
              </p>
            )}
          </div>

          {/* People */}
          {(project.people || []).length > 0 && (
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">People</span>
              <div className="flex flex-wrap gap-2">
                {project.people!.map((p) => (
                  <span key={p.contact_id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium">
                    <Users size={11} /> {p.name} {p.role && <span className="opacity-50">· {p.role}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {(project.attachments || []).length > 0 && (
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Attachments</span>
              <div className="space-y-1">
                {project.attachments!.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    <Paperclip size={12} /> {a.file_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Projects Panel ────────────────────────────────────────────────────────────

const ProjectsPanel: React.FC = () => {
  const { projects, addProject, updateProject, removeProject } = useActionsStore();
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const project: Project = {
      id: generateId(),
      title: newTitle.trim(),
      status: 'active',
      tasks: [],
      notes: '',
      people: [],
      attachments: [],
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addProject(project);
    setNewTitle('');
    setShowForm(false);
    try {
      const saved = await api.createProject(project);
      updateProject(project.id, { id: saved.id });
    } catch { toast.error('Project saved locally only.'); }
  };

  const handleUpdate = async (id: string, patch: Partial<Project>) => {
    updateProject(id, { ...patch, updated_at: new Date().toISOString() });
    try { await api.updateProject(id, patch); } catch { /* optimistic */ }
  };

  const handleDelete = async (id: string) => {
    removeProject(id);
    try { await api.deleteProject(id); } catch { /* already removed locally */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      {showForm && (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowForm(false); }}
            placeholder="Project name..."
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleAdd} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors">
            Create
          </button>
          <button onClick={() => setShowForm(false)} className="px-3 py-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FolderKanban size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No projects yet.</p>
          <p className="text-xs mt-1">Create a project to organize tasks, notes, and people.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Canvas (Mermaid.js) ──────────────────────────────────────────────────────

const CanvasPanel: React.FC = () => {
  const { projects, tasks } = useActionsStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mermaidReady, setMermaidReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [diagramDef, setDiagramDef] = useState('');

  // Build Mermaid diagram definition from live data
  const buildDiagram = useCallback(() => {
    const lines: string[] = ['graph TD'];
    const safeId = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);

    if (projects.length === 0 && tasks.length === 0) {
      lines.push('  A["No data yet — add projects and tasks"]');
    } else {
      projects.forEach((proj) => {
        const pid = `P_${safeId(proj.id)}`;
        lines.push(`  ${pid}["📁 ${proj.title.replace(/"/g, "'")}"]:::project`);

        (proj.tasks || []).forEach((task) => {
          const tid = `T_${safeId(task.id)}`;
          const icon = task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '📋';
          lines.push(`  ${tid}["${icon} ${task.title.replace(/"/g, "'")}"]:::task`);
          lines.push(`  ${pid} --> ${tid}`);
        });

        (proj.people || []).forEach((person) => {
          const perid = `Per_${safeId(person.contact_id)}`;
          lines.push(`  ${perid}(["👤 ${person.name.replace(/"/g, "'")}"]):::person`);
          lines.push(`  ${pid} -.-> ${perid}`);
        });
      });

      // Orphan tasks (no project)
      tasks
        .filter((t) => !t.project_id)
        .forEach((task) => {
          const tid = `T_${safeId(task.id)}`;
          const icon = task.status === 'completed' ? '✅' : '📋';
          lines.push(`  ${tid}["${icon} ${task.title.replace(/"/g, "'")}"]:::task`);
        });
    }

    lines.push('  classDef project fill:#3b82f6,stroke:#1d4ed8,color:#fff,rx:8');
    lines.push('  classDef task fill:#f1f5f9,stroke:#cbd5e1,color:#334155');
    lines.push('  classDef person fill:#a855f7,stroke:#7e22ce,color:#fff');

    return lines.join('\n');
  }, [projects, tasks]);

  useEffect(() => {
    setDiagramDef(buildDiagram());
  }, [buildDiagram]);

  // Lazy-load Mermaid and render
  useEffect(() => {
    if (!diagramDef || !containerRef.current) return;

    let cancelled = false;

    import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'Inter, sans-serif',
      });
      setMermaidReady(true);

      const id = `mermaid-canvas-${Date.now()}`;
      mermaid.render(id, diagramDef).then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRenderError(null);
        }
      }).catch((err: Error) => {
        if (!cancelled) setRenderError(err.message);
      });
    }).catch(() => {
      if (!cancelled) setRenderError('Mermaid library failed to load. Run: npm install mermaid');
    });

    return () => { cancelled = true; };
  }, [diagramDef]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 min-h-[500px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Network size={18} className="text-blue-500" />
            Project Graph
          </h3>
          <span className="text-xs text-slate-400">Auto-generated from your projects and tasks</span>
        </div>

        {renderError ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <AlertCircle size={32} className="text-amber-500" />
            <p className="text-sm font-medium text-center">{renderError}</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="w-full overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
          >
            {!mermaidReady && (
              <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Rendering diagram…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Raw definition preview */}
      <details className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <summary className="px-4 py-3 text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
          Mermaid Definition
        </summary>
        <pre className="px-4 pb-4 text-[11px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap overflow-x-auto">
          {diagramDef}
        </pre>
      </details>
    </div>
  );
};

// ── Actions Page ─────────────────────────────────────────────────────────────

const Actions: React.FC = () => {
  const { activeTab, setActiveTab, setTasks, setProjects } = useActionsStore();
  const { data: remoteTasks }    = useTasks();
  const { data: remoteProjects } = useProjects();

  // Hydrate Zustand store from backend on first load
  useEffect(() => {
    if (remoteTasks)    setTasks(remoteTasks);
  }, [remoteTasks, setTasks]);

  useEffect(() => {
    if (remoteProjects) setProjects(remoteProjects);
  }, [remoteProjects, setProjects]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
          Actions
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Tasks, projects, and relationship context — all in one place.
        </p>
      </div>

      {/* Tab Toggle — Item 11 */}
      <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300',
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {activeTab === 'tasks'    && <TasksPanel />}
      {activeTab === 'projects' && <ProjectsPanel />}
      {activeTab === 'canvas'   && <CanvasPanel />}
    </div>
  );
};

export default Actions;
