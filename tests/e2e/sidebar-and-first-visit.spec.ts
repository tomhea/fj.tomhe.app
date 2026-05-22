import { test, expect } from '@playwright/test';
import { freshSession } from './_helpers';

test.describe('Sidebar collapse', () => {
  test('Hide Explorer collapses to a 32-px rail; click chevron expands again', async ({ page }) => {
    await freshSession(page);

    // Sidebar starts expanded; "Hide Explorer" button is in the FileTree header.
    const hideBtn = page.locator('button[title="Hide Explorer"]');
    await expect(hideBtn).toBeVisible();
    await hideBtn.click();

    // After collapse, the Hide Explorer button disappears and main.fj row disappears.
    await expect(page.locator('button[title="Hide Explorer"]')).toHaveCount(0);
    await expect(page.locator('span.truncate', { hasText: /^main\.fj$/ })).toHaveCount(0);

    // The rail's "Show Explorer" button is the only thing left of the sidebar.
    const showBtn = page.locator('button[title="Show Explorer"]');
    await expect(showBtn).toBeVisible();
    await showBtn.click();

    // Back to expanded — Hide Explorer button is visible again.
    await expect(page.locator('button[title="Hide Explorer"]')).toBeVisible();
    await expect(page.locator('span.truncate', { hasText: /^main\.fj$/ })).toBeVisible();
  });

  test('Collapsed state persists across reload', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="Hide Explorer"]').click();
    await expect(page.locator('button[title="Show Explorer"]')).toBeVisible();

    await page.reload();
    await page.locator('.monaco-editor').waitFor();
    await expect(page.locator('button[title="Show Explorer"]')).toBeVisible();
  });
});

test.describe('First-visit hint', () => {
  test('shows a passive hint in the terminal on a brand-new session', async ({ page }) => {
    // Bypass freshSession because it sets fj-visited=1 to suppress the
    // auto-run / first-visit hint. We want a truly first-time page load.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('.monaco-editor').waitFor();
    // The hint shows up in the terminal via addLine('info', ...).
    await expect(page.locator('.terminal-text').getByText(/Click "Run FJ"/)).toBeVisible({ timeout: 10_000 });
  });

  test('hint does NOT show after the first visit (localStorage suppresses it)', async ({ page }) => {
    // Same setup but pre-set fj-visited so the hint is skipped.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('fj-visited', '1');
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('.monaco-editor').waitFor();
    await page.waitForTimeout(500); // give the effect time to run
    await expect(page.locator('.terminal-text').getByText(/Click "Run FJ"/)).toHaveCount(0);
  });
});