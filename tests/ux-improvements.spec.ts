import { test, expect } from '@playwright/test';

test.describe('UX Improvements Phase 1 & 2', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app (Dashboard is default)
        await page.goto('/');

        // Wait for the loading screen / initial render to complete
        await page.waitForSelector('h2', { timeout: 15000 });

        // Switch to Call Logs view and wait for lazy-loaded component
        await page.click('button:has-text("Call Logs")');
        await page.waitForSelector('h2:has-text("Call Logs")', { timeout: 10000 });
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

        // Verify group headers exist (rendered as h3 contact name headings)
        await expect(page.locator('h3').first()).toBeVisible({ timeout: 5000 });
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
        const firstCallHeading = page.locator('h4:has-text("Brandon Gilles")').first();
        await expect(firstCallHeading).toBeVisible();

        // Click the first call to expand it
        await firstCallHeading.click();

        // Check if "Executive Brief" is visible.
        // Mock data call-1 has it.
        const briefHeader = page.locator('h5', { hasText: 'Executive Brief' }).first();

        // Wait a bit for animation
        await expect(briefHeader).toBeVisible({ timeout: 5000 });

        // Find the "Tags" button (rendered as a text button, no title attribute)
        const tagsBtn = page.locator('button:has-text("Tags")').first();
        await expect(tagsBtn).toBeVisible();
        await tagsBtn.click();

        // Check for Tag Picker popover — the input appears after clicking Tags
        const searchInput = page.locator('input[placeholder="Enter label name"]');
        await expect(searchInput).toBeVisible({ timeout: 5000 });
    });
});
