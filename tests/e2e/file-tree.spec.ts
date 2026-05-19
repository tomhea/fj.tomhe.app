import { test, expect, Page, Locator } from '@playwright/test';
import { freshSession } from './_helpers';

// File-tree rows render the filename as a <span class="truncate">. New
// files also seed their content with `// <name>` (a comment with the
// filename in it), so a naked text= match collides with the editor token.
// fileRow targets ONLY the sidebar entry.
function fileRow(page: Page, name: string): Locator {
  return page.locator('span.truncate', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\\\]\\\\]/g, '\\$&')}$`) });
}

test.describe('File tree', () => {
  test('creates a new file via the + button', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="New file"]').click();
    const input = page.locator('input[value="untitled.fj"]');
    await expect(input).toBeFocused();
    await input.fill('helper.fj');
    await page.keyboard.press('Enter');
    await expect(fileRow(page, 'helper.fj')).toBeVisible();
  });

  test('Escape cancels new-file input', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="New file"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('input[value="untitled.fj"]')).toHaveCount(0);
  });

  test('rejects duplicate filename with inline error', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="New file"]').click();
    // Re-locate by the current value after each fill — the input's `value=`
    // attribute updates with the typed content so the original locator becomes
    // stale.
    await page.locator('input[value="untitled.fj"]').fill('main.fj');
    await page.keyboard.press('Enter');
    await expect(page.getByText('A file named "main.fj" already exists.')).toBeVisible();
    // Input stays open so the user can fix the name. (commitEdit early-returns
    // on collision without clearing editingId.)
    await expect(page.locator('input[value="main.fj"]')).toBeFocused();
  });

  test('renames a file via context menu', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="New file"]').click();
    await page.locator('input[value="untitled.fj"]').fill('extra.fj');
    await page.keyboard.press('Enter');
    await expect(fileRow(page, 'extra.fj')).toBeVisible();

    await fileRow(page, 'extra.fj').click({ button: 'right' });
    await page.getByRole('button', { name: 'Rename' }).click();
    const renameInput = page.locator('input[value="extra.fj"]');
    await renameInput.fill('renamed.fj');
    await page.keyboard.press('Enter');
    await expect(fileRow(page, 'renamed.fj')).toBeVisible();
    await expect(fileRow(page, 'extra.fj')).toHaveCount(0);
  });

  test('deletes a file via context menu', async ({ page }) => {
    await freshSession(page);
    await page.locator('button[title="New file"]').click();
    await page.locator('input[value="untitled.fj"]').fill('todelete.fj');
    await page.keyboard.press('Enter');
    await expect(fileRow(page, 'todelete.fj')).toBeVisible();

    await fileRow(page, 'todelete.fj').click({ button: 'right' });
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(fileRow(page, 'todelete.fj')).toHaveCount(0);
  });

  test('refuses to delete the last remaining file', async ({ page }) => {
    await freshSession(page);
    await fileRow(page, 'main.fj').click({ button: 'right' });
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(fileRow(page, 'main.fj')).toBeVisible();
  });
});
