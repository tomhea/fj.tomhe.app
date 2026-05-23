import { test, expect } from '@playwright/test';
import { freshSession, waitForTerminal, terminalText, toolbarBtn } from './_helpers';

test.describe('Compile/Run UX — timing visible and Run FJM after Run FJ', () => {
  test('Compile shows the four phase-timing lines on success', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Compile FJ → FJM');
    await waitForTerminal(page, /Compilation successful/);

    const txt = await terminalText(page);
    // All four `fj --asm` phase labels surface in the output, regardless of
    // whether the cached or uncached compile path served the request.
    expect(txt).toMatch(/parsing:\s+0\.\d+s/);
    expect(txt).toMatch(/macro resolve:\s+0\.\d+s/);
    expect(txt).toMatch(/labels resolve:\s+0\.\d+s/);
    expect(txt).toMatch(/create binary:\s+0\.\d+s/);
  });

  test('Run FJ makes the Run FJM button visible on completion', async ({ page }) => {
    await freshSession(page);

    const runFjm = page.locator('button[title="Run compiled FJM online"]');
    // Button starts hidden — nothing's been compiled yet.
    await expect(runFjm).toHaveCount(0);

    // Run FJ → process exits → fjm_compiled message arrives → compiledFjm
    // is set client-side → toolbar exposes the Run FJM button.
    await toolbarBtn(page, 'Compile and run FJ online');
    await waitForTerminal(page, /Process exited \(code 0\)/);
    await expect(runFjm).toBeVisible();

    // The button actually works — clicking it should re-run from the
    // stored .fjm. The IDE's specific "Running compiled FJM…" banner
    // disambiguates this from a fresh compile.
    await runFjm.click();
    await waitForTerminal(page, /Running compiled FJM/);
    await waitForTerminal(page, /Hello, World!/);
  });

  test('Editing source after Run FJ clears the compiled FJM (Run FJM hides)', async ({ page }) => {
    await freshSession(page);
    await toolbarBtn(page, 'Compile and run FJ online');
    await waitForTerminal(page, /Process exited \(code 0\)/);

    const runFjm = page.locator('button[title="Run compiled FJM online"]');
    await expect(runFjm).toBeVisible();

    // Mutate the source — `updateFileContent` in IDE.tsx sets compiledFjm
    // to null, so the toolbar's `compiledFjm && !isRunning` gate hides
    // the button. Same invariant the post-Compile flow already had.
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' ');
    await expect(runFjm).toHaveCount(0);
  });
});
