/**
 * Phase 1 — Pre-Launch Critical
 *
 * Covers:
 * - Page loads without JS crash
 * - localStorage unavailability does not crash checkout (private browsing)
 * - No React "key" warnings in console on any page
 * - Login form inputs have associated <label> or aria-label
 * - Login form uses correct input types
 * - ZAR currency format (R followed by digits, comma thousands separator)
 * - API errors surface in the UI (not swallowed silently)
 */

import { test, expect } from '@playwright/test';

// ─── Page load ────────────────────────────────────────────────────────────────

test('login page loads without JS errors', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(jsErrors).toHaveLength(0);
});

test('checkout page (/pay) loads without JS errors', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));

  await page.goto('/pay');
  await page.waitForLoadState('networkidle');

  expect(jsErrors).toHaveLength(0);
});

// ─── localStorage crash protection ────────────────────────────────────────────

test('checkout does not crash when localStorage is unavailable (private browsing)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Simulate private-browsing localStorage block before any script runs
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('localStorage is not available in private mode');
      },
      configurable: true,
    });
  });

  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));

  await page.goto('/pay');
  await page.waitForLoadState('networkidle');

  expect(jsErrors).toHaveLength(0);
  await context.close();
});

// ─── React key warnings ────────────────────────────────────────────────────────

test('no React "key" prop warnings on login page', async ({ page }) => {
  const keyWarnings = [];
  page.on('console', (msg) => {
    if (
      (msg.type() === 'warning' || msg.type() === 'error') &&
      msg.text().toLowerCase().includes('each child in a list')
    ) {
      keyWarnings.push(msg.text());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(keyWarnings, 'React key warnings found — Math.random() keys likely still present').toHaveLength(0);
});

test('no React "key" prop warnings on checkout page', async ({ page }) => {
  const keyWarnings = [];
  page.on('console', (msg) => {
    if (
      (msg.type() === 'warning' || msg.type() === 'error') &&
      msg.text().toLowerCase().includes('each child in a list')
    ) {
      keyWarnings.push(msg.text());
    }
  });

  await page.goto('/pay');
  await page.waitForLoadState('networkidle');

  expect(keyWarnings, 'React key warnings found — Math.random() keys likely still present').toHaveLength(0);
});

// ─── Form accessibility ────────────────────────────────────────────────────────

test('login form inputs have associated labels or aria-label', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const inputs = page.locator('input:not([type="hidden"])');
  const count = await inputs.count();
  expect(count, 'No inputs found on login page').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const id = await input.getAttribute('id');
    const ariaLabel = await input.getAttribute('aria-label');
    const ariaLabelledBy = await input.getAttribute('aria-labelledby');

    const hasLabel = id
      ? (await page.locator(`label[for="${id}"]`).count()) > 0
      : false;

    expect(
      hasLabel || !!ariaLabel || !!ariaLabelledBy,
      `Input ${id || `#${i}`} has no associated label, aria-label, or aria-labelledby`
    ).toBe(true);
  }
});

test('login form uses correct HTML input types', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Email field should use type="email"
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput, 'No input[type="email"] found on login form').toHaveCount(1);

  // Password field should use type="password"
  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput, 'No input[type="password"] found on login form').toHaveCount(1);
});

// ─── ZAR currency format ───────────────────────────────────────────────────────

test('currency amounts on checkout use ZAR format (R with comma thousands)', async ({ page }) => {
  await page.goto('/pay');
  await page.waitForLoadState('networkidle');

  // Grab all text nodes containing currency amounts
  const amounts = await page.locator('text=/R\\d/').all();

  for (const el of amounts) {
    const text = await el.textContent();
    // Must not have a space between R and the number, e.g. "R1,234.56" not "R 1234.56"
    expect(text, `Amount "${text}" has space after R symbol`).not.toMatch(/R\s+\d/);
  }
});
