import { Page, expect } from '@playwright/test';

/** Reset localStorage + reload so each test starts from a clean Hello-World
 * default. Crucially we pre-set `fj-visited` so the auto-run-on-first-visit
 * doesn't race against the test's first interaction. */
export async function freshSession(page: Page): Promise<void> {
  // Capture browser console errors so CI logs show WHY Monaco failed (if it
  // does), without requiring a local repro.
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Mark as already-visited so the IDE skips its auto-run.
    localStorage.setItem('fj-visited', '1');
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Wait for the editor to actually mount.
  try {
    await page.locator('.monaco-editor').waitFor({ timeout: 45_000 });
  } catch (e) {
    // Dump any captured console errors to make CI failures easier to debug.
    if (consoleErrors.length) {
      console.error('Browser console errors captured before Monaco timeout:\n' +
        consoleErrors.join('\n'));
    }
    // Re-check whether the page even loaded (catch blank-page / 404 errors).
    const title = await page.title().catch(() => '(unknown)');
    const url = page.url();
    console.error(`Monaco did not mount. Page: ${url} | Title: ${title}`);
    throw e;
  }
}

/** Concatenated terminal text. The runner emits stdout in chunks and each
 * chunk becomes its own <div>, so "Hello, World!\n" can land split across
 * "H" + "ello, World!". We concat with no separator so a substring/regex
 * search against the rendered output works regardless of chunking. */
export async function terminalText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.terminal-text div'))
      .map((el) => el.textContent ?? '')
      .join('');
  });
}

/** Wait until the terminal contains a regex match, or fail with the latest text. */
export async function waitForTerminal(page: Page, re: RegExp, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const txt = await terminalText(page);
    if (re.test(txt)) return;
    await page.waitForTimeout(200);
  }
  const lastTxt = await terminalText(page);
  expect(lastTxt, `terminal did not match ${re} within ${timeoutMs}ms`).toMatch(re);
}

/** Click the toolbar button by its title (which doubles as accessible name). */
export async function toolbarBtn(page: Page, title: string): Promise<void> {
  await page.locator(`button[title="${title}"]`).first().click();
}
