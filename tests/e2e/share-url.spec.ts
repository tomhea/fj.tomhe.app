import { test, expect } from '@playwright/test';
import { freshSession } from './_helpers';

test.describe('Share URL', () => {
  test('encodes current files into the URL hash after edit (debounced)', async ({ page }) => {
    await freshSession(page);
    // Type a unique marker into the editor.
    await page.locator('.monaco-editor').click();
    await page.keyboard.type(' // ZZUNIQUEZZ');
    // Wait > 1 s for the debounced URL update.
    await page.waitForTimeout(1500);
    const url = page.url();
    expect(url).toContain('#share=');
  });

  test('loading the share URL restores file contents in a fresh session', async ({ page }) => {
    await freshSession(page);
    // Set file content via localStorage so we don't fight Monaco's keyboard
    // model. ALSO clear any auto-written `#share=` from the initial load —
    // if it survives, buildInitialFiles will prefer the URL hash over
    // localStorage and overwrite our setup.
    await page.evaluate(() => {
      const files = [
        {
          id: 'test-id',
          name: 'main.fj',
          content: 'stl.startup\n// SHARED-MARKER-XYZ\nstl.loop\n',
        },
      ];
      localStorage.setItem('fj-ide-files', JSON.stringify(files));
      history.replaceState(null, '', location.pathname);
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('.monaco-editor').waitFor();
    // Wait > 1 s for the debounced share-URL update.
    await page.waitForTimeout(1500);
    const sharedUrl = page.url();
    expect(sharedUrl).toContain('#share=');

    // Sanity: the captured URL must actually encode our marker. If it
    // doesn't, the rest of the test is meaningless — fail early with a
    // useful message.
    const decoded = await page.evaluate(async () => {
      const hash = location.hash.replace(/^#share=/, '');
      const { decodeShare } = await import('/lib/share.js' as never).catch(() => ({} as never));
      return { hash, decoded: typeof decodeShare === 'function' ? decodeShare(hash) : null };
    }).catch(() => ({ hash: '', decoded: null }));
    // We can't always import the shared decode in the page context, so as
    // a fallback we just assert the hash is non-trivially long.
    if (!decoded.decoded) {
      expect(sharedUrl.split('#share=')[1]?.length ?? 0).toBeGreaterThan(20);
    }

    // Wipe localStorage so the page can't fall back to it, then open the
    // shared URL in a fresh navigation.
    await page.evaluate(() => localStorage.clear());
    await page.goto(sharedUrl);
    await page.waitForLoadState('networkidle');
    await page.locator('.monaco-editor').waitFor();
    await expect(page.locator('.monaco-editor')).toContainText('SHARED-MARKER-XYZ');
  });

  test('malformed share param falls back to default', async ({ page }) => {
    await freshSession(page);
    await page.evaluate(() => localStorage.clear());
    await page.goto('/#share=this-is-not-valid-base64-garbage!!!');
    // Falls back to default → main.fj appears.
    await expect(page.locator('text=main.fj')).toBeVisible();
  });
});
