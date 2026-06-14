import { connectionLogger } from '@/utils/connectionLogger';
import { useGuardianStore, MissionReport } from '@/store/guardianStore';
import { supabase } from '@/lib/supabase';

class GuardianService {
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    connectionLogger.addLog('info', 'SYSTEM', 'GUARDIAN', 'Guardian Orchestrator Initialized');
    
    // Start background monitoring loops
    this.startHealthCheck();
    this.startMissionSimulation();
    this.subscribeToLogs();
  }

  private async startHealthCheck() {
    setInterval(async () => {
      try {
        if (!supabase) { this.handleSystemError('a1', 'Supabase Not Configured', 'Missing env vars'); return; }
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) {
          this.handleSystemError('a1', 'Supabase Connection Degraded', error.message);
        } else {
          // If was previously warning, fix it
          const agent = useGuardianStore.getState().agents.find(a => a.id === 'a1');
          if (agent?.status === 'warning') {
            this.executeMission('a1', 'REPAIR', 'Re-established Supabase Matrix Uplink', 'fixed');
          }
        }
      } catch (err: any) {
        this.handleSystemError('a1', 'Supabase Offline', err.message);
      }
    }, 60000); // Check every minute
  }

  private subscribeToLogs() {
    connectionLogger.subscribe((logs) => {
      const latest = logs[0];
      if (latest?.type === 'error') {
        this.analyzeError(latest);
      }
    });
  }

  private analyzeError(log: any) {
    // Basic heuristics for self-correction
    if (log.message.includes('fetch') || log.message.includes('network')) {
      this.executeMission('a2', 'SCANNING', `Analyzing Network Instability: ${log.url}`, 'verified');
    }
    
    if (log.message.includes('permission') || log.message.includes('auth')) {
      this.executeMission('a1', 'GUARDIAN', 'Verifying Auth Session Integrity', 'verified');
    }
  }

  private handleSystemError(agentId: string, title: string, details: string) {
    useGuardianStore.getState().updateAgent(agentId, { 
      status: 'warning',
      lastAction: title 
    });
    
    connectionLogger.addLog('warning', 'GUARDIAN', agentId, title, { details });
  }

  private async executeMission(agentId: string, action: string, details: string, result: MissionReport['result']) {
    const store = useGuardianStore.getState();
    const agent = store.agents.find(a => a.id === agentId);
    if (!agent) return;

    // Set agent to active
    store.updateAgent(agentId, { 
      status: action.toLowerCase() as any,
      progress: 0,
      lastAction: details
    });

    // Simulate progress
    let prog = 0;
    const interval = setInterval(() => {
      prog += 20;
      store.updateAgent(agentId, { progress: prog });
      
      if (prog >= 100) {
        clearInterval(interval);
        
        // Finalize mission
        store.updateAgent(agentId, { 
          status: 'idle', 
          progress: 0,
          missionCount: agent.missionCount + 1
        });

        store.addReport({
          id: Math.random().toString(36).substr(2, 9),
          agentName: agent.name,
          action: action.toUpperCase(),
          result: result,
          timestamp: new Date().toISOString(),
          details: details
        });

        connectionLogger.addLog('success', 'GUARDIAN', agent.name, `Mission Accomplished: ${action}`);
      }
    }, 400);
  }

  /**
   * COSMETIC_ONLY — generates randomized UI animation events for Guardian agent cards.
   * Does NOT perform real AI operations, backend calls, or health assessments.
   * Real health is provided by startHealthCheck() which calls /api/v1/health every 60s.
   * Do not add real backend calls here. See Constitution §13.
   */
  private startMissionSimulation() {
    setInterval(() => {
      const agents = useGuardianStore.getState().agents;
      const idleAgents = agents.filter(a => a.status === 'idle');
      
      if (idleAgents.length > 0 && Math.random() > 0.7) {
        const agent = idleAgents[Math.floor(Math.random() * idleAgents.length)];
        const missions: Record<string, { action: string, detail: string, res: MissionReport['result'] }> = {
          'scout': { action: 'SCANNING', detail: 'Optimized Cache Routes', res: 'optimized' },
          'fixer': { action: 'REPAIRING', detail: 'Purged Redundant Memory Blobs', res: 'fixed' },
          'guardian': { action: 'OPTIMIZING', detail: 'Hardened Security Protocols', res: 'verified' },
          'analyst': { action: 'OPTIMIZING', detail: 'Refined Intelligence Heuristics', res: 'optimized' },
        };
        
        if (agent) {
          const m = missions[agent.role];
          if (m) {
            this.executeMission(agent.id, m.action, m.detail, m.res);
          }
        }
      }
    }, 30000);
  }
}

export const guardianService = new GuardianService();
