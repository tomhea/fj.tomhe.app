import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { POST } from '@/app/api/cached-compile/route';

const MANIFEST_PATH = join(process.cwd(), 'public/example-fjms/manifest.json');
const manifestExists = existsSync(MANIFEST_PATH);

function makeReq(body: unknown, extraHeaders: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cached-compile', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

async function call(body: unknown): Promise<{ status: number; json: any }> {
  const res = await POST(makeReq(body));
  return { status: res.status, json: await res.json() };
}

describe('POST /api/cached-compile', () => {
  describe('validation', () => {
    it('rejects request missing X-Requested-With (CSRF guard)', async () => {
      // Build the request manually without the helper's auto-added CSRF header.
      const req = new NextRequest('http://localhost/api/cached-compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: 'hello-world' }),
      });
      const res = await POST(req);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/X-Requested-With/i);
    });

    it('rejects missing slug', async () => {
      const { status, json } = await call({});
      expect(status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects non-string slug', async () => {
      const { status, json } = await call({ slug: 42 });
      expect(status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects path-traversal slug', async () => {
      const { status, json } = await call({ slug: '../etc/passwd' });
      expect(status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects slug with path separator', async () => {
      const { status, json } = await call({ slug: 'foo/bar' });
      expect(status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects unknown but otherwise safe-looking slug', async () => {
      const { status, json } = await call({
        slug: 'this-is-not-a-known-example-slug-xyz',
      });
      // 400 if manifest is loaded and slug isn't in it; also acceptable
      // if no manifest exists (400 for "no manifest").
      expect([400, 404]).toContain(status);
      expect(json.success).toBe(false);
    });
  });

  describe.skipIf(!manifestExists)('with manifest', () => {
    it('returns base64 .fjm + four (cached) stderr lines for a known slug', async () => {
      const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<
        string,
        { slug: string }
      >;
      const entry = Object.values(manifest).find((m) => {
        const fjmPath = join(process.cwd(), 'public/example-fjms', `${m.slug}.fjm`);
        return existsSync(fjmPath);
      });
      if (!entry) {
        // Manifest is committed but no .fjm files yet (CI without fj).
        // Acceptable — the integration test handles that case.
        return;
      }
      const { status, json } = await call({ slug: entry.slug });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(typeof json.fjmBase64).toBe('string');
      expect(typeof json.stderr).toBe('string');
      // Stderr must contain four (cached) lines.
      const cachedLines = json.stderr.split('\n').filter((l: string) =>
        l.includes('(cached)'),
      );
      expect(cachedLines).toHaveLength(4);
      // FJM file magic: bytes "FJ@\0" = 0x46 0x4a 0x40 0x00.
      const bytes = Buffer.from(json.fjmBase64, 'base64');
      expect(bytes.length).toBeGreaterThan(16);
      expect(bytes[0]).toBe(0x46); // 'F'
      expect(bytes[1]).toBe(0x4a); // 'J'
    });
  });
});
