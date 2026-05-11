import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MissionReport {
  id: string;
  agentName: string;
  action: string;
  result: 'fixed' | 'optimized' | 'verified' | 'failed';
  timestamp: string;
  details: string;
  target?: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  role: 'scout' | 'fixer' | 'guardian' | 'analyst';
  status: 'idle' | 'scanning' | 'repairing' | 'optimizing' | 'warning';
  progress: number;
  missionCount: number;
  lastAction?: string;
}

interface GuardianState {
  reports: MissionReport[];
  agents: AgentStatus[];
  addReport: (report: MissionReport) => void;
  updateAgent: (id: string, patch: Partial<AgentStatus>) => void;
  clearReports: () => void;
}

export const useGuardianStore = create<GuardianState>()(
  persist(
    (set) => ({
      reports: [],
      agents: [
        { id: 'a1', name: 'AEGIS-01', role: 'guardian', status: 'idle', progress: 0, missionCount: 0 },
        { id: 'a2', name: 'PATHFINDER-04', role: 'scout', status: 'idle', progress: 0, missionCount: 0 },
        { id: 'a3', name: 'NEXUS-FIXER', role: 'fixer', status: 'idle', progress: 0, missionCount: 0 },
        { id: 'a4', name: 'LUMINA-AI', role: 'analyst', status: 'idle', progress: 0, missionCount: 0 },
      ],
      addReport: (report) => set((s) => ({ reports: [report, ...s.reports].slice(0, 100) })),
      updateAgent: (id, patch) => set((s) => ({
        agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a))
      })),
      clearReports: () => set({ reports: [] }),
    }),
    {
      name: 'horizon-guardian-store',
    }
  )
);
