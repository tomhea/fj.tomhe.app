import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSession } from './_helpers';

/**
 * Automated accessibility checks via axe-core.
 *
 * We tag the assertions to WCAG 2.1 A/AA + the "best-practice" tag.
 * Failures here mean a measurable a11y regression — broken aria,
 * insufficient contrast, missing labels, etc. Color-contrast violations
 * inside Monaco are out of our control; we exclude `.monaco-editor` from
 * the scan so the IDE chrome itself is the unit under test.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function scan(page: import('@playwright/test').Page) {
  return await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('.monaco-editor')
    .analyze();
}

test.describe('Accessibility (axe-core)', () => {
  test('main IDE page has no axe-detected violations', async ({ page }) => {
    await freshSession(page);
    const r = await scan(page);
    expect(r.violations, JSON.stringify(r.violations, null, 2)).toEqual([]);
  });

  test('Docs panel (open) has no axe-detected violations', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="Open language reference and STL viewer"]').click();
    // Wait for the dialog to be in the focusable state.
    await page.locator('[role="dialog"]').waitFor();
    const r = await scan(page);
    expect(r.violations, JSON.stringify(r.violations, null, 2)).toEqual([]);
  });

  test('Examples dropdown (open) has no axe-detected violations', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="Load a built-in example"]').click();
    const r = await scan(page);
    expect(r.violations, JSON.stringify(r.violations, null, 2)).toEqual([]);
  });
});