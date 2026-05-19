import { test, expect } from '@playwright/test';
import { freshSession } from './_helpers';

test.describe('Docs panel', () => {
  test('opens via Docs button and shows FJ Reference content', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="Open language reference and STL viewer"]').click();

    const panel = page.locator('[role="dialog"]');
    await expect(panel).toBeVisible();
    // Section headings from the reference page
    await expect(panel.getByRole('heading', { name: 'Core Instruction' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Reserved Keywords' })).toBeVisible();
    // The reserved-keywords table lists the 7 real directives — sanity check
    // that the docs match the parser surface and won't regress to `.startup`.
    for (const kw of ['def', 'ns', 'rep', 'wflip', 'pad', 'segment', 'reserve']) {
      await expect(panel.locator('table').first()).toContainText(kw);
    }
  });

  test('closes on Escape', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="Open language reference and STL viewer"]').click();
    const panel = page.locator('[role="dialog"]');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    // Panel uses transform translateX(100%) when closed — assert it's
    // aria-hidden so the test isn't tied to the transition timing.
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
  });

  test('closes on × button click', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="Open language reference and STL viewer"]').click();
    const panel = page.locator('[role="dialog"]');
    await expect(panel).toBeVisible();
    await panel.locator('button:has-text("×")').click();
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
  });

  test('Standard Library tab loads STL index and shows runlib.fj', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="Open language reference and STL viewer"]').click();
    await page.getByRole('button', { name: 'Standard Library' }).click();
    // The STL index always contains runlib.fj at the root.
    await expect(page.getByText('runlib.fj').first()).toBeVisible({ timeout: 20_000 });
  });
});
