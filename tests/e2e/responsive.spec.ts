/**
 * Responsive / viewport tests.
 *
 * These tests document current behaviour at different screen sizes so
 * regressions are caught. They are intentionally minimal — they verify the
 * page doesn't crash and key elements are reachable, not that the layout is
 * pixel-perfect.  Tests marked @mobile should be revisited once responsive
 * CSS is added.
 */
import { test, expect } from '@playwright/test';
import { freshSession } from './_helpers';

const VIEWPORTS = [
  { name: 'phone (375×812)', width: 375, height: 812 },
  { name: 'tablet (768×1024)', width: 768, height: 1024 },
  { name: 'desktop (1280×800)', width: 1280, height: 800 },
  { name: 'wide (1920×1080)', width: 1920, height: 1080 },
] as const;

for (const vp of VIEWPORTS) {
  test(`IDE loads without JS errors at ${vp.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await freshSession(page);
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
}

test('toolbar is horizontally scrollable on narrow screen @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await freshSession(page);
  // The toolbar has overflow-x: auto — the Run FJ button must exist in the DOM
  // even if it requires scrolling.
  const runBtn = page.locator('button[title="Compile and run FJ online"]');
  await expect(runBtn).toBeAttached();
});

test('no horizontal page overflow on desktop @regression', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await freshSession(page);
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const clientWidth = await page.evaluate(() => document.body.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance for scrollbars
});
