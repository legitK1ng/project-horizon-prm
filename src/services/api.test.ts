
/// <reference types="vitest/globals" />

import { describe, it, expect, vi } from 'vitest';
import { api } from './apiClient';
import { mockFetch } from '../utils/testUtils';

// Mock global fetch
globalThis.fetch = vi.fn(mockFetch) as any;

describe('API Client', () => {
    it('fetches health stats correctly', async () => {
        const data = await api.getStats();
        expect(data).toBeDefined();
        expect(data.totalContacts).toBeGreaterThan(0);
    });

    it('fetches models', async () => {
        const models: any = await api.getModels();
        expect(models?.models).toHaveLength(1);
    });

    it('runs diagnostics', async () => {
        const results = await api.checkHealth();
        expect(results?.status).toBe('healthy');
    });
});


