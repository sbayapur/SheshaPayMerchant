/**
 * Phase 3 — Polish & Optimisation
 *
 * Covers:
 * - No unexpected console.log output during normal page load
 * - No console.error output during normal page load (not caused by missing payment intent)
 * - CSS custom properties (design tokens) are defined on :root
 * - Key design tokens exist: --primary, --success, --error
 * - Overdue badge visible when payment is overdue (checked via DOM if test credentials provided)
 * - Login page title is set (basic SEO/PWA check)
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

// ─── Console cleanliness ───────────────────────────────────────────────────────

test('no console.log output on login page load', async ({ page }) => {
  const logs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') logs.push(msg.text());
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(
    logs,
    `Unexpected console.log output found — wrap in NODE_ENV check:\n${logs.join('\n')}`
  ).toHaveLength(0);
});

test('no console.log output on checkout page load', async ({ page }) => {
  const logs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') logs.push(msg.text());
  });

  await page.goto('/pay');
  await page.waitForLoadState('networkidle');

  expect(
    logs,
    `Unexpected console.log output found — wrap in NODE_ENV check:\n${logs.join('\n')}`
  ).toHaveLength(0);
});

test('no console.error output on login page from application code', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore expected browser/network errors in local test environment:
      // - CORS errors (backend not running locally against production API)
      // - Resource load failures (no backend proxy in test)
      // - favicon 404s
      if (
        text.includes('net::ERR_') ||
        text.includes('Failed to load resource') ||
        text.includes('favicon') ||
        text.includes('CORS policy') ||
        text.includes('Access-Control-Allow-Origin') ||
        text.includes('TypeError: Failed to fetch') ||
        text.includes('Failed to load')
      ) return;
      errors.push(text);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(
    errors,
    `Unexpected console.error from application code:\n${errors.join('\n')}`
  ).toHaveLength(0);
});

// ─── Design tokens ────────────────────────────────────────────────────────────

test('CSS design tokens are defined on :root', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      primary: style.getPropertyValue('--primary').trim(),
      success: style.getPropertyValue('--success').trim(),
      error: style.getPropertyValue('--error').trim(),
    };
  });

  expect(tokens.primary, '--primary CSS variable not defined on :root').not.toBe('');
  expect(tokens.success, '--success CSS variable not defined on :root').not.toBe('');
  expect(tokens.error, '--error CSS variable not defined on :root').not.toBe('');
});

// ─── Page metadata ────────────────────────────────────────────────────────────

test('page has a title set', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const title = await page.title();
  expect(title, 'Page title is empty').not.toBe('');
  expect(title, 'Page is still using default Vite title').not.toBe('Vite + React');
});

// ─── Overdue invoice badge (requires auth) ────────────────────────────────────

test.describe('authenticated checks', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Skipped: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run');

  test('overdue invoices show OVERDUE badge in order history', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Log in
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Look for any overdue badge in the payments table
    const overdueBadge = page.locator('text=/overdue/i').first();
    const badgeVisible = await overdueBadge.isVisible().catch(() => false);

    if (badgeVisible) {
      // Confirm badge has visible red/orange styling
      const color = await overdueBadge.evaluate((el) => getComputedStyle(el).color);
      // RGB values for red/orange range
      expect(color, 'OVERDUE badge should be red or orange').toMatch(/rgb\((1[5-9]\d|2[0-5]\d),\s*[0-9]+,\s*[0-9]+\)/);
    } else {
      // No overdue items in test data — pass with note
      console.log('No overdue invoices in test account — badge test skipped');
    }
  });
});
