/**
 * TESTS & DIAGNOSTICS
 * 
 * Runs a suite of self-tests to verify backend integrity.
 */

function runBackendTests() {
    const results = [];

    // TEST 1: Helper - isJsonString
    try {
        const valid = isJsonString('{"a":1}');
        const invalid = isJsonString('not json');
        if (valid && !invalid) {
            results.push({ test: 'isJsonString', status: 'PASS' });
        } else {
            results.push({ test: 'isJsonString', status: 'FAIL', message: 'Validation logic incorrect' });
        }
    } catch (e) {
        results.push({ test: 'isJsonString', status: 'ERROR', message: e.message });
    }

    // TEST 2: Helper - isValidDate
    try {
        const valid = isValidDate(new Date());
        const invalid = isValidDate('not a date');
        if (valid && !invalid) {
            results.push({ test: 'isValidDate', status: 'PASS' });
        } else {
            results.push({ test: 'isValidDate', status: 'FAIL', message: 'Date validation logic incorrect' });
        }
    } catch (e) {
        results.push({ test: 'isValidDate', status: 'ERROR', message: e.message });
    }

    // TEST 3: Helper - dataToJSON
    try {
        const input = [['Name', 'Age'], ['Alice', 30]];
        const output = dataToJSON(input);
        if (output.length === 1 && output[0].name === 'Alice' && output[0].age === 30) {
            results.push({ test: 'dataToJSON', status: 'PASS' });
        } else {
            results.push({ test: 'dataToJSON', status: 'FAIL', message: 'JSON conversion incorrect' });
        }
    } catch (e) {
        results.push({ test: 'dataToJSON', status: 'ERROR', message: e.message });
    }

    // TEST 4: Gemini Key Presence
    try {
        const key = getGeminiKey();
        if (key && key.length > 20) {
            results.push({ test: 'Gemini Key Config', status: 'PASS' });
        } else {
            results.push({ test: 'Gemini Key Config', status: 'FAIL', message: 'Key missing or too short' });
        }
    } catch (e) {
        results.push({ test: 'Gemini Key Config', status: 'ERROR', message: e.message });
    }

    return {
        status: results.some(r => r.status !== 'PASS') ? 'review_required' : 'healthy',
        results: results
    };
}

/**
 * LIST GEMINI MODELS
 * Fetches available models from Google AI Studio API.
 */
function getGeminiModels() {
    try {
        // Reuse the listModel function from Config.gs
        const models = listModel();
        if (models && models.length > 0) {
            return { models: models.map(m => ({ name: m })) }; // Map to expected object format if needed, or just return names if frontend handles it
        } else {
            return { error: 'No models found or API Error' };
        }
    } catch (e) {
        return { error: e.message };
    }
}
