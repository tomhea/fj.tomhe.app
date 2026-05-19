import { test, expect } from '@playwright/test';
import { freshSession, waitForTerminal } from './_helpers';

const cases: Array<{ name: string; expectedOutput: RegExp }> = [
  { name: 'Hello World', expectedOutput: /Hello, World!/ },
  { name: 'Counter (0–9)', expectedOutput: /0123456789/ },
  { name: 'Alphabet', expectedOutput: /abcdefghijklmnopqrstuvwxyz/ },
  { name: 'Hex Digits', expectedOutput: /0123456789ABCDEF/ },
  { name: 'Multi-file', expectedOutput: /Hello from greet/ },
];

test.describe('Examples dropdown', () => {
  test('opens, lists every example, and closes on outside click', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="Load a built-in example"]').click();
    for (const c of cases) {
      await expect(page.locator(`button:has-text("${c.name}")`)).toBeVisible();
    }
    // Click the backdrop / outside the menu to close.
    await page.locator('body').click({ position: { x: 5, y: 200 } });
    await expect(page.locator('button:has-text("Counter (0–9)")')).toHaveCount(0);
  });

  for (const c of cases) {
    test(`${c.name} loads, compiles, runs, prints expected output`, async ({ page }) => {
      await freshSession(page);
      await page.locator('button[title="Load a built-in example"]').click();
      await page.locator(`button:has-text("${c.name}")`).click();
      await page.locator('button[title="Compile and run FJ online"]').click();
      await waitForTerminal(page, c.expectedOutput);
      await waitForTerminal(page, /Process exited \(code 0\)/);
    });
  }
});
