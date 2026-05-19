import { Page, expect } from '@playwright/test';

/** Reset localStorage + reload so each test starts from a clean Hello-World
 * default. Crucially we pre-set `fj-visited` so the auto-run-on-first-visit
 * doesn't race against the test's first interaction. */
export async function freshSession(page: Page): Promise<void> {
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
  await page.locator('.monaco-editor').waitFor();
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
