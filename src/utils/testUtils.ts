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
    // Default data fetch
    return Promise.resolve({
        ok: true,
        headers: {
            get: () => 'application/json'
        },
        json: () => Promise.resolve({ status: 'success', logs: mockApis.logs, contacts: [] })
    });
};
