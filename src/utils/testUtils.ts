export const mockApis = {
    logs: [
        {
            timestamp: new Date().toISOString(),
            contact_name: 'Test User',
            phone_number: '1234567890',
            duration: '05:00',
            transcript: 'This is a test call.',
            strategic_notes: JSON.stringify({ title: 'Test Call', summary: 'Summary' }),
            tags: '#test',
            status: 'COMPLETED',
            external_id: 'test-id-1'
        }
    ],
    models: {
        models: [
            { name: 'models/gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' }
        ]
    },
    diagnostics: {
        status: 'healthy',
        results: [
            { test: 'isJsonString', status: 'PASS' }
        ]
    }
};

export const mockFetch = (url: string) => {
    if (url.includes('action=list_models')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockApis.models)
        });
    }
    if (url.includes('action=run_tests')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockApis.diagnostics)
        });
    }
    // getStats() calls /api/v1/data
    if (url.includes('/api/v1/data')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                totalContacts: 100,
                totalCalls: 50,
                avgCallDuration: 300,
                recentActivity: 25
            })
        });
    }
    // checkHealth() calls /api/v1/health
    if (url.includes('/api/v1/health')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'healthy' })
        });
    }
    // getModels() calls /api/v1/system/models
    if (url.includes('/api/v1/system/models')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockApis.models)
        });
    }
    // Default data fetch
    return Promise.resolve({
        ok: true,
        headers: {
            get: () => 'application/json'
        },
        json: () => Promise.resolve({ status: 'success', logs: mockApis.logs, contacts: [] })
    });
};
