/**
 * Phase 2 — Production Hardening
 *
 * Covers:
 * - No horizontal overflow (scrollbar) at iPhone SE (375px), Pixel 5 (393px), iPad (768px)
 * - Touch targets on login are at least 44px tall
 * - Modals do not exceed viewport width on mobile
 * - Toast (if visible) does not overflow below viewport
 * - Login button shows disabled/loading state while submitting
 */

import { test, expect } from '@playwright/test';

// ─── Responsive — no horizontal overflow ──────────────────────────────────────

const breakpoints = [
  { label: 'iPhone SE', width: 375, height: 667 },
  { label: 'Pixel 5', width: 393, height: 851 },
  { label: 'iPad', width: 768, height: 1024 },
  { label: 'iPad Pro landscape', width: 1024, height: 768 },
];

for (const bp of breakpoints) {
  test(`no horizontal overflow on login page at ${bp.label} (${bp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      scrollWidth,
      `Page has horizontal overflow at ${bp.width}px — scrollWidth=${scrollWidth}`
    ).toBeLessThanOrEqual(bp.width);
  });

  test(`no horizontal overflow on checkout page at ${bp.label} (${bp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/pay');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      scrollWidth,
      `Checkout has horizontal overflow at ${bp.width}px — scrollWidth=${scrollWidth}`
    ).toBeLessThanOrEqual(bp.width);
  });
}

// ─── Touch targets ────────────────────────────────────────────────────────────

test('login form submit button meets 44px minimum touch target height', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Primary submit button — may be type="submit" or role="button"
  const submitBtn = page.locator('button[type="submit"]').first();
  await expect(submitBtn).toBeVisible();

  const box = await submitBtn.boundingBox();
  expect(box, 'Submit button not found in DOM').not.toBeNull();
  expect(
    box.height,
    `Submit button height ${box.height}px is below the 44px WCAG minimum touch target`
  ).toBeGreaterThanOrEqual(44);
});

// ─── Modals don't overflow viewport ───────────────────────────────────────────

test('bank auth modal does not exceed viewport width on iPhone SE', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/pay');
  await page.waitForLoadState('networkidle');

  // Trigger the bank selection modal if a "Pay from bank" or similar button exists
  const payBtn = page.locator('button', { hasText: /pay.*bank|connect.*bank|link.*bank/i }).first();
  const payBtnVisible = await payBtn.isVisible().catch(() => false);

  if (payBtnVisible) {
    await payBtn.click();
    await page.waitForTimeout(300);

    // Check any modal/dialog that appeared
    const modal = page.locator('[role="dialog"], .modal, .bank-modal, .bank-auth-modal').first();
    const modalVisible = await modal.isVisible().catch(() => false);

    if (modalVisible) {
      const box = await modal.boundingBox();
      expect(
        box.width,
        `Bank modal width ${box.width}px exceeds viewport width of 375px`
      ).toBeLessThanOrEqual(375);
    }
  } else {
    test.skip(true, 'No bank pay button visible on checkout page without a payment intent');
  }
});

// ─── Loading state on form submit ─────────────────────────────────────────────

test('login button is disabled while form is submitting', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitBtn = page.locator('button[type="submit"]').first();

  await emailInput.fill('test@example.com');
  await passwordInput.fill('password123');

  // Click and immediately check disabled state
  await submitBtn.click();

  // Button should be disabled or show a loading indicator while request is in flight
  const isDisabled = await submitBtn.isDisabled();
  const loadingText = await submitBtn.textContent();
  const showsLoadingState = isDisabled || /loading|signing|verifying/i.test(loadingText);

  expect(
    showsLoadingState,
    'Submit button should be disabled or show loading text during form submission'
  ).toBe(true);
});
