import { test, expect } from '@playwright/test';
import { freshSession, toolbarBtn, waitForTerminal } from './_helpers';

test.describe('Keyboard navigation', () => {
  test('Escape closes the DocsPanel when it is open', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Open language reference and STL viewer');
    const panel = page.locator('[role="dialog"]');
    await expect(panel).toBeVisible();
    // Give React's useEffect time to attach the keydown listener before pressing Escape.
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    // DocsPanel is always mounted — when closed it gets the `inert` boolean
    // attribute (React sets it as inert="") and a translateX(100%) transform.
    // `toHaveCount(0)` would never pass because the [role="dialog"] node stays
    // in the DOM. Match the canonical assertion used by docs-panel.spec.ts
    // (`closes on Escape`) and verify `inert` instead.
    await expect(panel).toHaveAttribute('inert', '');
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
