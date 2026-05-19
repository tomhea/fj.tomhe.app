import { test, expect } from '@playwright/test';
import { freshSession, toolbarBtn, waitForTerminal } from './_helpers';

test.describe('Keyboard navigation', () => {
  test('Escape closes the DocsPanel when it is open', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Open language reference and STL viewer');
    await page.locator('[role="dialog"]').waitFor();
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });

  test('Tab is trapped inside DocsPanel while it is open', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Open language reference and STL viewer');
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor();

    // Tab from within the dialog — focus should not escape to elements outside.
    // We focus the first button in the dialog, then Tab through all focusable
    // elements; focus must stay inside the dialog.
    const firstBtn = dialog.locator('button').first();
    await firstBtn.focus();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const activeRole = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.closest('[role="dialog"]') !== null : true;
      });
      expect(activeRole).toBe(true);
    }
  });

  test.skip('Ctrl+Enter triggers Run FJ — requires keyboard shortcuts feature', async ({ page }) => {
    // TODO: implement keyboard shortcuts in IDE.tsx (Area 3 of the plan),
    // then remove this .skip and assert the terminal receives output.
    await freshSession(page);
    await page.keyboard.press('Control+Enter');
    await waitForTerminal(page, /Hello, World!/);
  });

  test.skip('Arrow keys navigate the file tree — not yet implemented', async ({ page }) => {
    // TODO: implement keyboard navigation in FileTree.tsx, then remove .skip.
    await freshSession(page);
    await page.locator('text=main.fj').focus();
    await page.keyboard.press('ArrowDown');
  });
});
