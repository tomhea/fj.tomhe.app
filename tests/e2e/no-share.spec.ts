import { test, expect } from '@playwright/test';
import { freshSession } from './_helpers';

test.describe('Share-URL removal', () => {
  test('editing files does NOT add #share= or ?share= to the URL', async ({ page }) => {
    await freshSession(page);
    await page.locator('.monaco-editor').click();
    await page.keyboard.type(' // ZZNOSHAREZZ');
    // The legacy debounce was 1 s — wait well past that so a stale impl would fire.
    await page.waitForTimeout(1800);
    const url = page.url();
    expect(url).not.toContain('#share=');
    expect(url).not.toContain('?share=');
    expect(url).not.toContain('&share=');
  });

  test('a #share= fragment in the URL is ignored — default Hello World loads', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('fj-visited', '1');
    });
    await page.goto('/#share=AAAA');
    await page.waitForLoadState('networkidle');
    await page.locator('.monaco-editor').waitFor({ timeout: 45_000 });
    // Default project shows hello.fj in the file tree.
    await expect(page.locator('text=hello.fj')).toBeVisible();
  });

  test('a ?share= query param is ignored — default Hello World loads', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('fj-visited', '1');
    });
    await page.goto('/?share=AAAA');
    await page.waitForLoadState('networkidle');
    await page.locator('.monaco-editor').waitFor({ timeout: 45_000 });
    await expect(page.locator('text=hello.fj')).toBeVisible();
  });

  test('open files persist across reload via fj-ide-files localStorage', async ({ page }) => {
    await freshSession(page);
    // Seed localStorage with a known file set; reload; verify it survives.
    await page.evaluate(() => {
      const files = [
        { id: 'persist-id', name: 'persist.fj', content: 'stl.startup\n// PERSIST-MARKER\nstl.loop\n' },
      ];
      localStorage.setItem('fj-ide-files', JSON.stringify(files));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('.monaco-editor').waitFor({ timeout: 45_000 });
    await expect(page.locator('text=persist.fj')).toBeVisible();
    await expect(page.locator('.monaco-editor')).toContainText('PERSIST-MARKER');
  });

  test('Toolbar has no Short Link / Copy Link / spoo.me references', async ({ page }) => {
    await freshSession(page);
    // No Copy Link button.
    await expect(page.locator('button:has-text("Copy Link")')).toHaveCount(0);
    // No Short Link button.
    await expect(page.locator('button:has-text("Short Link")')).toHaveCount(0);
    // No spoo.me titles anywhere.
    await expect(page.locator('[title*="spoo.me" i]')).toHaveCount(0);
    // No "Copied!" state from the removed Copy Link flow.
    await expect(page.locator('button:has-text("Copied!")')).toHaveCount(0);
  });

  test('Footer renders with "FlipJump IDE by Tomhe" and two GitHub links', async ({ page }) => {
    await freshSession(page);
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('FlipJump IDE by Tomhe');

    const appLink = footer.locator('a[href="https://github.com/tomhea/fj.tomhe.app"]');
    const fjLink = footer.locator('a[href="https://github.com/tomhea/flip-jump"]');
    await expect(appLink).toBeVisible();
    await expect(fjLink).toBeVisible();
    // Both open in a new tab.
    await expect(appLink).toHaveAttribute('target', '_blank');
    await expect(fjLink).toHaveAttribute('target', '_blank');
    await expect(appLink).toHaveAttribute('rel', /noopener/);
    await expect(fjLink).toHaveAttribute('rel', /noopener/);
  });
});
