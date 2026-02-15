
/// <reference types="vitest/globals" />

import { describe, it, expect, vi } from 'vitest';
import { fetchModels, runBackendDiagnostics, fetchProjectHorizonData } from './apiService';
import { mockFetch } from '../utils/testUtils';

// Mock global fetch
globalThis.fetch = vi.fn(mockFetch) as any;

describe('API Service', () => {
    it('fetches logs and transforms them correctly', async () => {
        // Mock the return of fetchProjectHorizonData or the underlying fetch
        // Since we mocked global.fetch, fetchProjectHorizonData should work.
        const data = await fetchProjectHorizonData();
        if (!data) throw new Error('Data is null');

        if (!data || !data.calls) throw new Error('Data or calls is null');

        expect(data.calls).toHaveLength(1);
        expect(data.calls![0]!.contactName).toBe('Test User');
        expect(data.calls![0]!.tags).toContain('#test');
        expect(data.calls![0]!.status).toBe('COMPLETED');
    });

    it('fetches models', async () => {
        const models = await fetchModels();
        expect(models?.models).toHaveLength(1);
    });

    it('runs diagnostics', async () => {
        const results = await runBackendDiagnostics();
        expect(results?.status).toBe('healthy');
    });
});


