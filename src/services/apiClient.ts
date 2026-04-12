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
    return ApiListResponseSchema(CallRecordSchema).parse(res).data;
  }

  async ingestCall(payload: any): Promise<CallRecord> {
    const res = await this.request<any>('/api/v1/calls', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return CallRecordSchema.parse(res.data);
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
    const res = await this.request<any>(`/api/v1/enrichment/?contact_id=${contactId}`);
    return res.data || [];
  }

  async triggerEnrichment(contact_id: string): Promise<{ status: string; job_id: string }> {
    return this.request('/api/v1/enrichment/', {
      method: 'POST',
      body: JSON.stringify({ contact_id })
    });
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
