/**
 * Social Saver — End-to-End Tests
 *
 * Two core tests that validate the dashboard's critical paths:
 *   1. Dashboard loads and displays saved content cards.
 *   2. "Ask My Saves" returns an AI reply with source citations.
 *
 * Both tests use Playwright network mocking so they run offline / in CI
 * without real Supabase or OpenAI credentials.
 *
 * Run: npx playwright test tests/e2e.spec.ts --headed
 */

import { test, expect } from '@playwright/test';

// ── Shared mock data ────────────────────────────────────────────────────────

const MOCK_SAVES = [
    {
        id: 'abc-123',
        created_at: new Date().toISOString(),
        user_phone: 'demo',
        url: 'https://example.com/workout',
        source: 'instagram',
        title: 'Core Workout Routine',
        category: 'Fitness',
        tags: ['workout', 'core', 'fitness'],
        summary: 'A quick 5-min standing ab circuit you can do anywhere.',
        status: 'complete',
        is_deleted: false,
    },
];

const MOCK_AI_REPLY = {
    reply: 'Based on your saves, I found a great core workout routine [1].',
    citations: [
        {
            save_id: 'abc-123',
            title: 'Core Workout Routine',
            url: 'https://example.com/workout',
            source: 'vector',
        },
    ],
};

// ── Helper: intercept all Supabase REST API calls ───────────────────────────

async function mockSupabase(page: any) {
    // Handle CORS preflight
    await page.route('**/*', async (route: any) => {
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                },
            });
            return;
        }
        await route.continue();
    });

    // Mock get-saves edge function (replaces old direct REST /saves endpoint after RLS lockdown)
    await page.route('**/functions/v1/get-saves*', async (route: any) => {
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(MOCK_SAVES),
        });
    });
}

// ── Test 1: Dashboard loads and displays saves ───────────────────────────────

test('Dashboard loads and displays saves', async ({ page }) => {
    await mockSupabase(page);

    // Navigate with demo user param
    await page.goto('http://localhost:5173/?u=demo');
    await page.waitForLoadState('networkidle');

    // Header must be present
    await expect(page.getByRole('button', { name: 'Social Saver' })).toBeVisible({ timeout: 10000 });

    // "Your Content Library" heading
    await expect(page.getByText('Your Content Library', { exact: false }).first()).toBeVisible();

    // The mock save's summary text must be visible on a card
    await expect(
        page.getByText('A quick 5-min standing ab circuit', { exact: false })
    ).toBeVisible({ timeout: 15000 });
});

// ── Test 2: Ask My Saves returns an AI reply with citations ──────────────────

test('Ask My Saves returns an AI reply with source citations', async ({ page }) => {
    await mockSupabase(page);

    // Mock the chat-brain edge function
    await page.route('**/functions/v1/chat-brain', async (route: any) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(MOCK_AI_REPLY),
        });
    });

    await page.goto('http://localhost:5173/?u=demo');
    await page.waitForLoadState('networkidle');

    // Locate the "Ask my second brain" input
    const askInput = page.locator('input[placeholder="Ask your second brain anything…"]');
    await expect(askInput).toBeVisible({ timeout: 10000 });

    // Type a query and submit
    await askInput.fill('show me my workout saves');
    await askInput.press('Enter');

    // AI reply block (.prose) should appear
    await expect(page.locator('.prose').first()).toBeVisible({ timeout: 15000 });

    // "Sources used" section must be visible
    await expect(page.getByText('Sources used', { exact: false })).toBeVisible({ timeout: 10000 });
});
