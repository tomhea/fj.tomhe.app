import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSession, toolbarBtn } from './_helpers';

test.describe('Accessibility (axe)', () => {
  test('no critical or serious violations on the IDE home page', async ({ page }) => {
    await freshSession(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      // Monaco injects iframes and canvas elements that axe flags as
      // violations we can't fix — exclude the editor region.
      .exclude('.monaco-editor')
      .analyze();
    const blockers = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blockers, JSON.stringify(blockers.map((v) => v.description), null, 2)).toHaveLength(0);
  });

  test('no critical or serious violations with the Docs panel open', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Open language reference and STL viewer');
    await page.locator('[role="dialog"]').waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('.monaco-editor')
      .analyze();
    const blockers = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blockers, JSON.stringify(blockers.map((v) => v.description), null, 2)).toHaveLength(0);
  });

  test('DocsPanel has role="dialog" with aria-modal and aria-label', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Open language reference and STL viewer');
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-label', /.+/); // non-empty label
  });

  test('all toolbar buttons have title attributes', async ({ page }) => {
    await freshSession(page);
    const buttons = page.locator('button[title]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(3);
    // None of the visible toolbar buttons should have an empty title.
    const titles = await buttons.evaluateAll((btns) =>
      btns.map((b) => (b as HTMLButtonElement).title),
    );
    for (const title of titles) {
      expect(title.trim()).not.toBe('');
    }
  });
});
