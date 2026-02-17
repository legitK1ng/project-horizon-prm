import { test, expect } from '@playwright/test';

test.describe('UX Improvements Phase 1 & 2', () => {
    test.beforeEach(async ({ page }) => {
        // Monitor console logs to see what URL is being hit
        page.on('console', msg => console.log(`BROWSER LISTENER: ${msg.text()}`));

        // Mock API handlers - target EVERYTHING not local
        await page.route('**/*', async route => {
            const request = route.request();
            const url = request.url();
            const method = request.method();

            // Allow local assets
            if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('vite') || url.includes('.tsx') || url.includes('.ts') || url.includes('.css')) {
                return route.continue();
            }

            // Mock Data Fallback
            // If the app tries to fetch data, we abort to force the useData hook to use mock data
            // But we can also specifically mock successful responses if needed.
            // For this test suite (UX), we want stable data.

            console.log(`INTERCEPTING (${method}): ${url}`);

            // Abort external requests to force mock fallback (handled by useData catch block)
            await route.abort();
        });

        // Clear local storage and reload to ensure clean state
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
        });
        await page.reload();

        // Wait for Mock Data to load (Dashboard shows "Connection Alert" when offline/mock)
        // This is robust because we are forcing offline mode via route aborts
        await expect(page.locator('text=Connection Alert').first()).toBeVisible({ timeout: 10000 });

        // Switch to Call Logs view
        await page.click('text=Logs');
        await expect(page).toHaveURL(/\/$/);

        // Verify we are in Logs view
        await expect(page.locator('h2')).toHaveText('Call Logs');
    });

    test('should support Group by Contact', async ({ page }) => {
        // Toggle Group By Contact
        await page.click('button[title="Group by Contact"]');

        // Check for Alphabet Scroller
        // It renders only if there are groups. Mock data has groups.
        const scroller = page.locator('.fixed.right-4');
        await expect(scroller).toBeVisible();

        // Verify group headers exist
        // CallLog renders groups with id="group-{Letter}"
        await expect(page.locator('[id^="group-"]')).not.toHaveCount(0);
    });

    test('should support Date Range filtering', async ({ page }) => {
        // Click the Date Range Picker button to open the popover
        await page.click('button[title="Filter by Date Range"]');

        // Now the inputs should be visible
        const startDateInput = page.locator('input[aria-label="Start Date"]');
        await expect(startDateInput).toBeVisible();

        // Set a date range
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        await startDateInput.fill(dateStr);
        await expect(startDateInput).toHaveValue(dateStr);
    });

    test('should allow tagging calls', async ({ page }) => {
        // Ensure we are in Date view (default)
        // The button for Date view is the one with Calendar icon
        const groupByDateBtn = page.locator('button[title="Sort by Date"]');

        // Ensure we are in date mode. If the button is not "active" (white bg), click it.
        const btnClass = await groupByDateBtn.getAttribute('class');
        if (btnClass && !btnClass.includes('bg-white')) {
            await groupByDateBtn.click();
        }

        // Wait for calls to render
        const callRows = page.locator('.group');
        await expect(callRows.first()).toBeVisible();

        // Click the first call's clickable area specifically
        // The first child div of .group is the trigger
        await callRows.first().locator('div').first().click();

        // Check if "Executive Brief" is visible. 
        // Mock data call-1 has it.
        const briefHeader = page.locator('h5', { hasText: 'Executive Brief' }).first();

        // Wait a bit for animation
        await expect(briefHeader).toBeVisible({ timeout: 5000 });

        // Find the "Tags" button
        const tagsBtn = page.locator('button[title="Add/Edit Tags"]');
        await expect(tagsBtn).toBeVisible();
        await tagsBtn.click();

        // Check for Tag Picker popover
        // It has absolute positioning and "Enter label name" placeholder
        const tagPicker = page.locator('.absolute.z-50');
        await expect(tagPicker).toBeVisible();

        // Verify we can type in the search box
        const searchInput = tagPicker.locator('input[placeholder="Enter label name"]');
        await expect(searchInput).toBeVisible();
    });
});
