import { test, expect } from '@playwright/test';
import { freshSession, waitForTerminal, toolbarBtn, terminalText } from './_helpers';

test.describe('Default Hello World', () => {
  test('page loads with main.fj in the tree and editor visible', async ({ page }) => {
    await freshSession(page);
    await expect(page).toHaveTitle(/FlipJump IDE/);
    await expect(page.locator('text=main.fj')).toBeVisible();
    await expect(page.locator('button[title="Compile FJ → FJM"]')).toBeVisible();
    await expect(page.locator('button[title="Compile and run FJ online"]')).toBeVisible();
  });

  test('Compile → Run prints Hello, World! and exits 0', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Compile and run FJ online');
    await waitForTerminal(page, /Hello, World!/);
    await waitForTerminal(page, /Process exited \(code 0\)/);
  });

  test('Compile alone produces success (no Run)', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Compile FJ → FJM');
    await waitForTerminal(page, /Compilation successful/);
    // After successful compile, the Run FJM button becomes visible.
    await expect(page.locator('button[title="Run compiled FJM online"]')).toBeVisible();
  });

  test('Editing source clears the compiled FJM (Run FJM hides)', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Compile FJ → FJM');
    await waitForTerminal(page, /Compilation successful/);
    await expect(page.locator('button[title="Run compiled FJM online"]')).toBeVisible();

    // Type into the editor to invalidate the compile.
    await page.locator('.monaco-editor').click();
    await page.keyboard.type(' ');
    await expect(page.locator('button[title="Run compiled FJM online"]')).toHaveCount(0);
  });

  test('Invalid FJ shows error markers in editor', async ({ page }) => {
    await freshSession(page);
    // Replace the source with garbage.
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('this is not valid fj ###');
    await toolbarBtn(page, 'Compile FJ → FJM');
    // The terminal should surface the error.
    const txt = await (async () => {
      let last = '';
      for (let i = 0; i < 30; i++) {
        last = await terminalText(page);
        if (/error|Error|parsing|Lexing|Syntax/i.test(last)) return last;
        await page.waitForTimeout(200);
      }
      return last;
    })();
    expect(txt).toMatch(/error|Error|parsing|Lexing|Syntax/i);
  });
});
