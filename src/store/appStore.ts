/**
 * Horizon PRM — Centralized Zustand State Management
 * Items 17, 6, 3 — UI state, data state, session state
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Task, Project } from '@/types';

// ── UI State ────────────────────────────────────────────────────────────────

interface UiState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

  // Chat window
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  chatWidth: number;
  chatHeight: number;
  setChatSize: (width: number, height: number) => void;
  chatPosition: { x: number; y: number };
  setChatPosition: (pos: { x: number; y: number }) => void;

  // Active sidebar/drawer
  activeDrawerContactId: string | null;
  setActiveDrawerContactId: (id: string | null) => void;

  // Dashboard widget order
  widgetOrder: string[];
  setWidgetOrder: (order: string[]) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      setTheme: (theme) => {
        set({ theme });
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },

      chatOpen: false,
      setChatOpen: (open) => set({ chatOpen: open }),
      chatWidth: 380,
      chatHeight: 550,
      setChatSize: (width, height) => set({ chatWidth: width, chatHeight: height }),
      chatPosition: { x: 0, y: 0 },
      setChatPosition: (pos) => set({ chatPosition: pos }),

      activeDrawerContactId: null,
      setActiveDrawerContactId: (id) => set({ activeDrawerContactId: id }),

      widgetOrder: ['stats', 'relationship-graph', 'most-contacted', 'call-log', 'nudges', 'inner-circle', 'health'],
      setWidgetOrder: (order) => set({ widgetOrder: order }),
    }),
    {
      name: 'horizon-ui-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        chatOpen: state.chatOpen,
        chatWidth: state.chatWidth,
        chatHeight: state.chatHeight,
        chatPosition: state.chatPosition,
        widgetOrder: state.widgetOrder,
      }),
    }
  )
);

// ── Actions/Tasks/Projects State ────────────────────────────────────────────

interface ActionsState {
  tasks: Task[];
  projects: Project[];
  activeTab: 'tasks' | 'projects' | 'canvas';
  setActiveTab: (tab: 'tasks' | 'projects' | 'canvas') => void;
  setTasks: (tasks: Task[]) => void;
  setProjects: (projects: Project[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
}

export const useActionsStore = create<ActionsState>((set) => ({
  tasks: [],
  projects: [],
  activeTab: 'tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTasks: (tasks) => set({ tasks }),
  setProjects: (projects) => set({ projects }),
  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
  updateTask: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
  updateProject: (id, patch) =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
}));

// ── Session State ────────────────────────────────────────────────────────────

interface SessionState {
  activeContactFilter: string;
  setActiveContactFilter: (filter: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  lastVisitedRoute: string;
  setLastVisitedRoute: (route: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeContactFilter: 'all',
      setActiveContactFilter: (filter) => set({ activeContactFilter: filter }),
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),
      lastVisitedRoute: '/',
      setLastVisitedRoute: (route) => set({ lastVisitedRoute: route }),
    }),
    {
      name: 'horizon-session',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
