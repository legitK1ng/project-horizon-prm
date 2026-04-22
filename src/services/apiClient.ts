/**
 * Project Horizon — Intelligent API Client
 * REQ-025: Production-grade fetch wrapper with Zod validation.
 */
import {
  ContactSchema,
  CallRecordSchema,
  ApiListResponseSchema
} from '../schemas/api';
import { Contact, CallRecord, DashboardStats, Nudge, GoogleTokenResponse } from '../types';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;

    // 10-second timeout to prevent indefinite hangs
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `API Error: ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(id);
    }
  }

  // REQ-014: Health Check
  async checkHealth(): Promise<{ status: string }> {
    return this.request('/api/v1/health');
  }

  // --- CONTACTS ---

  async getContacts(page = 0, limit = 500): Promise<{ data: Contact[]; total_count: number; has_more: boolean }> {
    const res = await this.request<any>(`/api/v1/contacts?page=${page}&limit=${limit}`);
    return {
      data: res.data || [],
      total_count: res.total_count ?? res.count ?? 0,
      has_more: res.has_more ?? false,
    };
  }

  /** Auto-paginate to load ALL contacts (e.g. 1822 with limit=500 = 4 requests) */
  async getAllContacts(): Promise<Contact[]> {
    let all: Contact[] = [];
    let page = 0;
    while (true) {
      const res = await this.getContacts(page, 500);
      all = [...all, ...res.data];
      if (!res.has_more) break;
      page++;
    }
    return all;
  }

  async getContact(id: string): Promise<Contact> {
    const res = await this.request<any>(`/api/v1/contacts/${id}`);
    return ContactSchema.parse(res.data ?? res);
  }

  async toggleFavorite(contactId: string): Promise<{ is_favorite: boolean }> {
    return this.request(`/api/v1/contacts/${contactId}/favorite`, { method: 'PATCH' });
  }

  async getContactPhotos(contactId: string): Promise<string[]> {
    const res = await this.request<any>(`/api/v1/enrichments/${contactId}/photos`);
    return res.photos || [];
  }

  async setContactPhoto(contactId: string, photoUrl: string): Promise<void> {
    await this.request(`/api/v1/contacts/${contactId}/photo`, {
      method: 'POST',
      body: JSON.stringify({ photo_url: photoUrl }),
    });
  }


  // --- CALLS ---

  async getCalls(): Promise<CallRecord[]> {
    const res = await this.request<any>('/api/v1/calls');
    return ApiListResponseSchema(CallRecordSchema).parse(res).data as CallRecord[];
  }

  async ingestCall(payload: any): Promise<CallRecord> {
    const res = await this.request<any>('/api/v1/calls', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return CallRecordSchema.parse(res.data) as CallRecord;
  }

  // --- ENRICHMENT / NUDGES ---

  async getStats(): Promise<DashboardStats> {
    return this.request('/api/v1/data'); // Consolidated dashboard data endpoint
  }

  async getNudges(): Promise<Nudge[]> {
    const res = await this.request<any>('/api/v1/nudges');
    return res.data || [];
  }

  async refreshHealth(contactId?: string): Promise<{ status: string }> {
    const endpoint = contactId
      ? `/api/v1/contacts/${contactId}/refresh-health`
      : '/api/v1/nudges/refresh-all';
    return this.request(endpoint, { method: 'POST' });
  }

  async getEnrichmentJobs(contactId: string): Promise<any[]> {
    const res = await this.request<any>(`/api/v1/enrichments/?contact_id=${contactId}`);
    return res.data || [];
  }

  async triggerEnrichment(contact_id: string): Promise<{ status: string; job_id: string }> {
    return this.request('/api/v1/enrichments/', {
      method: 'POST',
      body: JSON.stringify({ contact_id })
    });
  }

  // --- AI / INTELLIGENCE ---

  async aiChat(message: string, contextId?: string): Promise<{ message: string; context_used: boolean }> {
    const res = await this.request<any>('/api/v1/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context_id: contextId })
    });
    return {
      message: res.message || '',
      context_used: !!res.context_used
    };
  }

  async updateContact(id: string, contactData: any) {
    return this.request(`/api/v1/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(contactData),
    });
  }

  /** Search contacts by name/phone/email — routes to the real contacts list endpoint */
  async searchPerson(query: string) {
    const res = await this.request<any>(`/api/v1/contacts?search=${encodeURIComponent(query)}&limit=20`);
    return res.data || [];
  }

  async getModels() {
    return this.request('/api/v1/system/models');
  }

  async analyzeText(transcript: string): Promise<any> {
    const res = await this.request<any>('/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ transcript })
    });
    return res.data;
  }

  // --- SYSTEM / DIAGNOSTICS ---

  async fetchModels(): Promise<{ name: string; displayName: string }[]> {
    const res = await this.request<any>('/api/v1/system/models');
    return res.models || [];
  }

  async runDiagnostics(): Promise<{ status: string; results: any[] }> {
    return this.request('/api/v1/system/diagnostics');
  }

  async testGeminiConnection(): Promise<any> {
    return this.request('/api/v1/system/test-gemini');
  }

  async triggerProcessing(): Promise<any> {
    return this.request('/api/v1/system/trigger-processing');
  }

  // --- TASKS (Item 11) ---

  async getTasks(): Promise<any[]> {
    const res = await this.request<any>('/api/v1/actions/tasks');
    return res.data || [];
  }

  async createTask(task: any): Promise<any> {
    const res = await this.request<any>('/api/v1/actions/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
    return res.data ?? res;
  }

  async updateTask(id: string, patch: any): Promise<any> {
    const res = await this.request<any>(`/api/v1/actions/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return res.data ?? res;
  }

  async deleteTask(id: string): Promise<void> {
    await this.request(`/api/v1/actions/tasks/${id}`, { method: 'DELETE' });
  }

  // --- PROJECTS (Item 11) ---

  async getProjects(): Promise<any[]> {
    const res = await this.request<any>('/api/v1/actions/projects');
    return res.data || [];
  }

  async createProject(project: any): Promise<any> {
    const res = await this.request<any>('/api/v1/actions/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    return res.data ?? res;
  }

  async updateProject(id: string, patch: any): Promise<any> {
    const res = await this.request<any>(`/api/v1/actions/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return res.data ?? res;
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/api/v1/actions/projects/${id}`, { method: 'DELETE' });
  }

  // --- OLLAMA / kimi-k2:1t-cloud (Item 5) ---
  // Cloud-hosted via Ollama daemon — no local VRAM needed.

  async ollamaGenerate(prompt: string, model = 'minimax-m2.7:cloud'): Promise<{ response: string }> {
    return this.request('/api/v1/ollama/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, model }),
    });
  }

  async ollamaModels(): Promise<{ models: string[]; default_model: string }> {
    return this.request('/api/v1/ollama/models');
  }

  async ollamaHealth(): Promise<{ status: string; version?: string; model?: string }> {
    return this.request('/api/v1/ollama/health');
  }

  async processTranscript(transcript: string, contactName = 'Unknown'): Promise<any> {
    // Routes to kimi-k2:1t-cloud via Ollama daemon
    const res = await this.request<any>('/api/v1/ollama/process-transcript', {
      method: 'POST',
      body: JSON.stringify({ transcript, contact_name: contactName }),
    });
    return res.data ?? res;
  }

  // Embeddings use Google text-embedding-004 (cloud, no VRAM)
  async embedText(text: string): Promise<{ embedding: number[]; dims: number; model: string }> {
    return this.request('/api/v1/ai/embed', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  // --- SSE REAL-TIME (Item 18) ---

  subscribeToEvents(onEvent: (event: any) => void): () => void {
    const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    const source = new EventSource(`${BASE}/api/v1/events/stream`);
    source.onmessage = (e) => {
      try { onEvent(JSON.parse(e.data)); } catch { /* non-JSON heartbeat */ }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }

  // --- GOOGLE INTEGRATION ---

  async exchangeGoogleCode(code: string, userId: string, redirectUri: string): Promise<GoogleTokenResponse> {
    return this.request('/api/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code, user_id: userId, redirect_uri: redirectUri }),
    });
  }

  async syncGoogleContacts(userId: string, accessToken: string): Promise<{ status: string; count: number }> {
    return this.request('/api/v1/sync/google', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, access_token: accessToken }),
    });
  }
}

export const api = new ApiClient();
