import { test, expect } from '@playwright/test';
import { freshSession, toolbarBtn } from './_helpers';

test.describe('STL search', () => {
  async function openStlTab(page: Parameters<typeof freshSession>[0]) {
    await freshSession(page);
    await toolbarBtn(page, 'Open language reference and STL viewer');
    await page.locator('[role="dialog"]').waitFor();
    // Click the Standard Library tab
    await page.locator('button', { hasText: 'Standard Library' }).click();
    // Wait for the STL tree to load (the search input appears when index is ready)
    await page.locator('input[aria-label="Search standard library"]').waitFor({ timeout: 10_000 });
  }

  test('search input is visible in the STL tab', async ({ page }) => {
    await openStlTab(page);
    await expect(page.locator('input[aria-label="Search standard library"]')).toBeVisible();
  });

  test('typing a query filters the file list', async ({ page }) => {
    await openStlTab(page);
    const searchInput = page.locator('input[aria-label="Search standard library"]');
    // Before search: directories are visible (tree mode)
    await searchInput.fill('runlib');
    // Should show at least one result matching "runlib"
    await expect(page.locator('text=runlib.fj')).toBeVisible({ timeout: 5_000 });
  });

  test('shows "No results" when no files match the query', async ({ page }) => {
    await openStlTab(page);
    await page.locator('input[aria-label="Search standard library"]').fill('xxxxxxnotarealfilen');
    await expect(page.locator('text=No results')).toBeVisible({ timeout: 5_000 });
  });

  test('clear button (×) resets the search and restores the tree', async ({ page }) => {
    await openStlTab(page);
    const searchInput = page.locator('input[aria-label="Search standard library"]');
    await searchInput.fill('runlib');
    await expect(page.locator('text=runlib.fj')).toBeVisible();

    await page.locator('button[aria-label="Clear search"]').click();
    expect(await searchInput.inputValue()).toBe('');
    // Tree view is restored — "No results" is gone
    await expect(page.locator('text=No results')).toHaveCount(0);
  });

  test('clicking a search result loads the file in the editor', async ({ page }) => {
    await openStlTab(page);
    await page.locator('input[aria-label="Search standard library"]').fill('runlib');
    await page.locator('text=runlib.fj').first().click();
    // The breadcrumb / path bar should show the selected file
    await expect(page.locator('text=runlib.fj').first()).toBeVisible();
    // The Monaco editor pane should appear
    await page.locator('.monaco-editor').waitFor({ timeout: 10_000 });
  });
});
