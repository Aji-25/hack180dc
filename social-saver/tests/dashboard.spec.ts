import { test, expect } from '@playwright/test';

test.describe('Dashboard e2e tests', () => {
    test.beforeEach(async ({ page }) => {
        // Go to local dev server (assuming it runs on port 5173 for Vite)
        await page.goto('http://localhost:5173/');
    });

    test('Loads the dashboard and displays saves', async ({ page }) => {
        // Mock Supabase REST response for saves
        await page.route('**/rest/v1/saves*', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'Access-Control-Allow-Origin': '*' },
                json: [
                    { id: '1', created_at: new Date().toISOString(), user_phone: 'demo', url: 'https://example.com', source: 'instagram', title: 'Core workout routine', category: 'Fitness', tags: ['workout'], summary: 'A quick 5-min standing ab circuit.', status: 'complete' }
                ]
            });
        });

        await page.goto('http://localhost:5173/?u=demo');
        await page.waitForLoadState('networkidle');

        // Header verification
        await expect(page.getByRole('button', { name: 'Social Saver' })).toBeVisible();
        await expect(page.getByText('Your Content Library').first()).toBeVisible();

        // Cards verification - wait for specific mock data to load
        // Text is rendered as summary instead of title for mock items with a summary
        await expect(page.getByText('A quick 5-min standing ab circuit', { exact: false })).toBeVisible({ timeout: 15000 });
    });

    test('Ask My Saves functionality works', async ({ page }) => {
        // Mock the fetch request to the edge function so it works reliably
        await page.route('**/chat-brain', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                json: {
                    reply: "This is a mock AI reply.",
                    citations: [{ save_id: '1', title: 'Mock Source', url: 'https://example.com', source: 'local' }]
                }
            });
        });

        await page.goto('http://localhost:5173/?u=demo');
        await page.waitForLoadState('networkidle');

        // Ask My Saves section
        const askInput = page.locator('input[placeholder="Ask your second brain anything…"]');
        await expect(askInput).toBeVisible();

        // Type a query that matches mock data
        await askInput.fill('workout');
        await askInput.press('Enter');



        // After processing, AI response should show up
        await expect(page.locator('.prose')).toBeVisible({ timeout: 15000 });

        // "Sources used" label
        const references = page.getByText('Sources used', { exact: false });
        await expect(references).toBeVisible();
    });
});
