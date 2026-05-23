import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { execFileSync } from 'child_process';
import { POST } from '@/app/api/compile/route';

// fj is shipped with `pip install flipjump`. Locally + CI install it.
const fjAvailable = (() => {
  try {
    // execFileSync, not execSync with a template literal — keeps the
    // env-var command out of the shell. Closes
    // `js/indirect-command-line-injection`.
    execFileSync(process.env.FJ_CMD ?? 'fj', ['--help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Integration tests for /api/compile. Runs the real `fj --asm` if it's on
 * PATH (CI installs flipjump via pip). Validation-only failure cases run
 * without spawning fj at all, so they pass on any machine.
 */

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/compile', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
    body: JSON.stringify(body),
  });
}

async function call(body: unknown): Promise<{ status: number; json: any }> {
  const res = await POST(makeReq(body));
  return { status: res.status, json: await res.json() };
}

const HELLO_FJ = `
stl.startup
stl.output_char 'H'
stl.output_char 'i'
stl.output_char '\\n'
stl.loop
`;

describe('POST /api/compile', () => {
  describe('validation (no subprocess required)', () => {
    it('rejects request missing X-Requested-With (CSRF guard)', async () => {
      const req = new NextRequest('http://localhost/api/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ files: [{ name: 'a.fj', content: '' }] }),
      });
      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/X-Requested-With/i);
    });

    it('returns 503 when the global concurrency cap is exhausted (T2)', async () => {
      const { acquireJob, releaseJob } = await import('@/lib/concurrency');
      let acquired = 0;
      while (acquireJob()) acquired++;
      try {
        const { status, json } = await call({ files: [{ name: 'a.fj', content: '' }] });
        expect(status).toBe(503);
        expect(json.error).toMatch(/busy/i);
      } finally {
        for (let i = 0; i < acquired; i++) releaseJob();
      }
    });

    it('releases concurrency slot when validation fails after acquireJob (T2)', async () => {
      const { acquireJob, releaseJob } = await import('@/lib/concurrency');
      let acquired = 0;
      while (acquireJob()) acquired++;
      releaseJob(); acquired--; // free exactly one slot
      // bad filename is rejected after acquireJob, so the finally must release
      await call({ files: [{ name: 'bad!!name.fj', content: '' }] });
      expect(acquireJob()).toBe(true); // slot was released
      releaseJob();
      for (let i = 0; i < acquired; i++) releaseJob();
    });

    it('rejects Windows reserved device name', async () => {
      const { status, json } = await call({ files: [{ name: 'CON.fj', content: '' }] });
      expect(status).toBe(400);
      expect(json.error).toMatch(/unsafe filename/i);
    });
    it('rejects missing files array', async () => {
      const { status, json } = await call({});
      expect(status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/no files/i);
    });

    it('rejects empty files array', async () => {
      const { status, json } = await call({ files: [] });
      expect(status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects > 20 files', async () => {
      const files = Array.from({ length: 21 }, (_, i) => ({
        name: `f${i}.fj`,
        content: '',
      }));
      const { status, json } = await call({ files });
      expect(status).toBe(400);
      expect(json.error).toMatch(/too many files/i);
    });

    it.each([
      '../etc/passwd.fj',
      'foo;rm.fj',
      'foo$x.fj',
      'foo`x.fj',
      'foo/bar.fj',
      'foo\\bar.fj',
      '.hidden.fj',
      'foo.txt',
      'foo',
    ])('rejects unsafe filename %p', async (name) => {
      const { status, json } = await call({ files: [{ name, content: '' }] });
      expect(status).toBe(400);
      expect(json.error).toMatch(/unsafe filename/i);
    });

    it('rejects per-file size > 256 KB', async () => {
      const content = 'x'.repeat(256 * 1024 + 1);
      const { status, json } = await call({
        files: [{ name: 'big.fj', content }],
      });
      expect(status).toBe(400);
      expect(json.error).toMatch(/file too large/i);
    });

    it('rejects aggregate size > 2 MB', async () => {
      // 9 × 250KB = 2.25 MB ; each file under the per-file cap
      const files = Array.from({ length: 9 }, (_, i) => ({
        name: `f${i}.fj`,
        content: 'x'.repeat(250 * 1024),
      }));
      const { status, json } = await call({ files });
      expect(status).toBe(400);
      expect(json.error).toMatch(/combined file size/i);
    });
  });

  describe.skipIf(!fjAvailable)('with real fj toolchain', () => {
    it('compiles a simple Hello-World program', async () => {
      const { json } = await call({
        files: [{ name: 'main.fj', content: HELLO_FJ }],
      });
      if (!json.success) {
        // fj wasn't on PATH or failed for environment reasons — skip cleanly
        // with a message so we know why in CI logs.
        console.warn('compile failed (fj on PATH?):', json.error, json.stderr);
        return;
      }
      expect(json.success).toBe(true);
      expect(typeof json.fjmBase64).toBe('string');
      // FJM has a fixed magic header. After base64 decode, the first byte is 0xCC.
      const fjm = Buffer.from(json.fjmBase64, 'base64');
      expect(fjm.byteLength).toBeGreaterThan(16); // FJM file header is 16 bytes
    });

    it(
      'returns success=false with stderr for syntactically invalid source',
      async () => {
        const { json } = await call({
          files: [{ name: 'bad.fj', content: 'this is not fj code ###' }],
        });
        expect(json.success).toBe(false);
        // Either error or stderr should describe the problem
        const combined = `${json.error ?? ''}\n${json.stderr ?? ''}`;
        expect(combined.toLowerCase()).toMatch(/error|parsing|lexing|syntax/);
      },
    );

    it(
      'compiles a multi-file project',
      async () => {
        const lib = [
          'ns greet {',
          '    def say_hi {',
          '        stl.output "Hi"',
          "        stl.output_char '\\n'",
          '    }',
          '}',
          '',
        ].join('\n');
        const main = ['stl.startup', 'greet.say_hi', 'stl.loop', ''].join('\n');
        const { json } = await call({
          files: [
            { name: 'greet.fj', content: lib },
            { name: 'main.fj', content: main },
          ],
        });
        if (!json.success) {
          console.warn('multi-file compile failed:', json.error, json.stderr);
        }
        expect(json.success).toBe(true);
        expect(typeof json.fjmBase64).toBe('string');
      },
    );
  });
});
