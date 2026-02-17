import { test, expect } from '@playwright/test';

test.describe('Phase 3 Features', () => {

    test.beforeEach(async ({ page }) => {
        // Monitor console logs to see what URL is being hit
        page.on('console', msg => console.log(`BROWSER LISTENER: ${msg.text()}`));

        // Log the environment variable to verify it's present
        await page.addInitScript(() => {
            console.log('VITE_BACKEND_URL from meta:', import.meta.env.VITE_BACKEND_URL);
        });

        // Mock API handlers - target EVERYTHING not local
        await page.route('**/*', async route => {
            const request = route.request();
            const url = request.url();

            // Allow local assets
            if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('vite') || url.includes('.tsx') || url.includes('.ts') || url.includes('.css')) {
                return route.continue();
            }

            const method = request.method();
            console.log(`INTERCEPTING (${method}): ${url}`);

            // 1. Mock Search Person (GET with action=search_person)
            if (method === 'GET' && url.includes('action=search_person')) {
                console.log('MOCKING SEARCH PERSON');
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        found: true,
                        name: 'Brandon Gilles',
                        organization: 'Luxe Real Estate',
                        email: 'brandon@luxe.com',
                        photoUrl: 'https://via.placeholder.com/150'
                    })
                });
                return;
            }

            // 2. Mock Analyze Text (POST with action=analyze_text)
            const postData = request.postData();
            if (method === 'POST' && postData && postData.includes('analyze_text')) {
                console.log('MOCKING ANALYZE TEXT');
                await new Promise(r => setTimeout(r, 1000)); // Add delay to verify "Processing..." state
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'success',
                        data: {
                            title: 'Mock Analysis Result',
                            summary: 'This is a mocked analysis result for testing.',
                            actionItems: ['Mock Action 1', 'Mock Action 2'],
                            tags: ['#mock', '#test'],
                            sentiment: 'Positive'
                        }
                    })
                });
                return;
            }

            // 3. Abort Main Data Fetch (GET to root or exec without action)
            // This ensures useData falls back to MOCK_CALLS
            if (method === 'GET' && !url.includes('action=')) {
                console.log('ABORTING MAIN FETCH -> Expecting Fallback to Mocks');
                await route.abort();
                return;
            }

            // Default abort for any other external calls
            console.log('ABORTING UNKNOWN EXTERNAL REQUEST');
            await route.abort();
        });

        // Clear local storage and reload to ensure clean state
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            console.log('LocalStorage CLEARED');
        });
        await page.reload();

        // Wait for Mock Data to load (Dashboard shows "Connection Alert" when offline)
        await expect(page.locator('text=Connection Alert').first()).toBeVisible({ timeout: 10000 });
    });

    test('should open Edit Contact modal', async ({ page }) => {
        // Navigate to Call Logs
        await page.click('text=Logs');

        // Find Brandon Gilles row
        const brandon = page.locator('h4', { hasText: 'Brandon Gilles' }).first();
        await expect(brandon).toBeVisible();

        // Hover over the contact name
        await brandon.hover();

        // Wait for HoverCard content
        const orgInfo = page.locator('text=Luxe Real Estate');
        await expect(orgInfo).toBeVisible({ timeout: 5000 });

        // Click Edit Button inside HoverCard
        const editBtn = page.locator('button[title="Edit Contact"]');
        await expect(editBtn).toBeVisible();
        await editBtn.click();

        // Check for Modal
        await expect(page.locator('h3', { hasText: 'Edit Contact' })).toBeVisible();
        await page.click('button:has-text("Cancel")');
    });

    test('should display Action Log', async ({ page }) => {
        await page.click('text=Actions');
        // Check for "Actionable Input: Horizon..." title from MOCK_CALLS
        const callTitle = page.locator('text=Horizon Project Timeline');
        await expect(callTitle).toBeVisible();
        await callTitle.click();
        await expect(page.locator('text=Finalize API documentation')).toBeVisible();
    });

    test('should navigate to Processing Lab and analyze text', async ({ page }) => {
        await page.click('text=Lab');
        await page.locator('textarea').fill('Testing Lab Analysis.');
        await page.click('button:has-text("Analyze Text")');
        await expect(page.locator('text=Processing...')).toBeVisible();
        // The Lab component renders the 'summary', not the 'title' header dynamically in some versions.
        // It hardcodes "Analysis Results". Let's check for the specific summary text from the mock.
        await expect(page.locator('text=This is a mocked analysis result')).toBeVisible({ timeout: 5000 });
    });

});
