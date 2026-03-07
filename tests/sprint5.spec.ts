import { test, expect } from '@playwright/test';

test.describe('Sprint 5 Polish & Features', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app before each test
        await page.goto('/');
        // Wait for the loading screen to disappear and the lazy-loaded Dashboard to resolve
        await page.waitForSelector('text=Connecting to Horizon...', { state: 'hidden', timeout: 30000 });
        await page.waitForSelector('h2', { timeout: 10000 });
    });

    test('Dashboard should have inline command palette trigger', async ({ page }) => {
        // 1. Check for the "Search..." trigger inside the Dashboard header
        // Use getByText with exact false to wait for it.
        const searchTrigger = page.locator('button', { hasText: 'Search...' });
        await expect(searchTrigger).toBeVisible({ timeout: 10000 });

        // 2. Click the trigger to open Command Palette
        await searchTrigger.click();

        // 3. Command Palette dialog should appear
        const paletteInput = page.getByPlaceholder('Search calls, contacts, or navigate...');
        await expect(paletteInput).toBeVisible();

        // 4. Close Palette
        await page.keyboard.press('Escape');
        await expect(paletteInput).toBeHidden();
    });

    test('Actions Log should have design system polish and toast notifications', async ({ page }) => {
        await page.click('button:has-text("Actions")');
        await page.waitForSelector('h2:has-text("Actions Log")', { timeout: 10000 });
        await expect(page.locator('h2', { hasText: 'Actions Log' })).toBeVisible();

        // Check if we have action items or not (might be empty initially)
        const hasItems = await page.locator('text=items across').isVisible();
        const emptyState = await page.locator('text=No action items yet').isVisible();

        if (hasItems) {
            // Find the first action call card
            const firstCallCard = page.locator('.card').first();
            await expect(firstCallCard).toBeVisible();

            // Click to expand it
            await firstCallCard.click();

            // Hover over action item to reveal copy/calendar buttons, then click copy
            const actionItem = page.locator('.card .group').first();
            await expect(actionItem).toBeVisible();
            await actionItem.hover();

            const copyBtnByTitle = actionItem.locator('button[title="Copy to Clipboard"]');
            await expect(copyBtnByTitle).toBeVisible();

            await copyBtnByTitle.click();

            // Toast should appear
            const toast = page.locator('text=Copied to clipboard');
            await expect(toast).toBeVisible();
        } else {
            expect(emptyState).toBeTruthy();
        }
    });

    test('Contacts list should have polished cards', async ({ page }) => {
        // Navigate to Contacts
        await page.click('button:has-text("Contacts")');
        await page.waitForSelector('h2:has-text("Contacts")', { timeout: 10000 });
        await expect(page.locator('h2', { hasText: 'Contacts' })).toBeVisible();

        // Should have contacts using the card card-interactive classes
        const firstContactCard = page.locator('.card.card-interactive').first();
        await expect(firstContactCard).toBeVisible();

        // Click contact card opens ContactDetailDrawer
        // The drawer has multiple tabs, let's verify if the Details content is visible
        await firstContactCard.click();

        // Check for standard fields that should be in the details tab like 'Contact Information', or simply 'Email'
        await expect(page.getByText('Contact Information').first().or(page.locator('h2', { hasText: 'Contact Details' })).first().or(page.getByText('Email').first())).toBeVisible({ timeout: 5000 });

        // Close the drawer if possible, or just let test end
        const closeBtn = page.locator('button', { hasText: 'Close' }).first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        } else {
            await page.keyboard.press('Escape');
        }
    });

    test('Call Logs should display Transcript Chat UI and Contact Drawer', async ({ page }) => {
        await page.click('button:has-text("Call Logs")');
        await page.waitForSelector('h2:has-text("Call Logs")', { timeout: 10000 });
        await expect(page.locator('h2', { hasText: 'Call Logs' })).toBeVisible();

        // Now expand a specific call to see the Transcript Chat UI
        // Click the first call row (rendered as a clickable div with a heading)
        const firstCallRow = page.locator('h4:has-text("Brandon Gilles")').first();
        await expect(firstCallRow).toBeVisible();
        await firstCallRow.click(); // Expand call details

        // Look for the "Conversation" text or chat bubble article elements
        // The transcript section renders with role="article" for message bubbles
        const messageBubble = page.locator('[role="article"]').first();
        await expect(messageBubble).toBeVisible({ timeout: 10000 });

        // Verify MessageBubble rendered correctly
        expect(await page.locator('[role="article"]').count()).toBeGreaterThan(0);
        await page.screenshot({ path: 'test-results/transcript_chat_ui.png' });
    });
});
