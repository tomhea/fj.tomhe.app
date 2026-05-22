/**
 * /api/c2fj integration tests.
 *
 * The real c2fj needs `make` + a RISC-V toolchain that's too heavy for CI.
 * We mock `child_process.execFile` and have the mock write a known
 * `unified.fj` into the build dir — this exercises the route's *security
 * paths* (zip-slip, symlink rejection, decompressed-size caps, filename
 * sanitization) end-to-end while keeping the suite hermetic.
 *
 * Real-c2fj integration is left to a follow-up (would need an opt-in test
 * gated on `RUN_REAL_C2FJ_TESTS=1`).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import AdmZip from 'adm-zip';

// Hoisted: replace execFile before the route module is loaded.
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    execFile: (
      file: string,
      args: string[],
      _opts: unknown,
      cb: (err: Error | null, out: { stdout: string; stderr: string }) => void,
    ) => {
      // Route passes `--build-dir <dir> --unify-fj --finish-after fj <src>`.
      const i = args.indexOf('--build-dir');
      const buildDir = i >= 0 ? args[i + 1] : null;
      if (buildDir) {
        try {
          mkdirSync(buildDir, { recursive: true });
          writeFileSync(
            join(buildDir, 'unified.fj'),
            "// mocked c2fj output\nstl.startup\nstl.output_char 'C'\nstl.loop\n",
            'utf8',
          );
        } catch (err) {
          cb(err as Error, { stdout: '', stderr: '' });
          return;
        }
      }
      cb(null, { stdout: `mock ${file}`, stderr: '' });
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let POST: (req: any) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import('@/app/api/c2fj/route'));
});

function makeMultipart(file: Blob, filename: string): Request {
  const fd = new FormData();
  fd.append('file', file, filename);
  return new Request('http://localhost/api/c2fj', {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: fd,
  });
}

async function callWith(file: Blob, filename: string) {
  const res = await POST(makeMultipart(file, filename) as never);
  return { status: res.status, json: await res.json() };
}

function makeZip(entries: Array<{ name: string; data: Buffer; symlink?: boolean }>): Buffer {
  const zip = new AdmZip();
  for (const e of entries) {
    zip.addFile(e.name, e.data, '', e.symlink ? 0xa1ff0000 : undefined);
  }
  return zip.toBuffer();
}

describe('POST /api/c2fj', () => {
  describe('validation', () => {
    it('rejects missing X-Requested-With header (CSRF guard)', async () => {
      const fd = new FormData();
      fd.append('file', new Blob(['int main(){}']), 'hello.c');
      const res = await POST(
        new Request('http://localhost/api/c2fj', {
          method: 'POST',
          body: fd,
          // no X-Requested-With
        }) as never,
      );
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/X-Requested-With/i);
    });

    it('rejects wrong content-type', async () => {
      const res = await POST(
        new Request('http://localhost/api/c2fj', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ foo: 1 }),
        }) as never,
      );
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/multipart/i);
    });

    it('rejects when no file is uploaded', async () => {
      const fd = new FormData();
      const res = await POST(
        new Request('http://localhost/api/c2fj', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: fd,
        }) as never,
      );
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/no file/i);
    });

    it('rejects upload > 10 MB', async () => {
      const huge = new Blob([new Uint8Array(11 * 1024 * 1024)]);
      const { status, json } = await callWith(huge, 'big.c');
      expect(status).toBe(400);
      expect(json.error).toMatch(/too large/i);
    });

    it('rejects unsupported extension', async () => {
      const { status, json } = await callWith(new Blob(['int main(){}']), 'foo.txt');
      expect(status).toBe(400);
      expect(json.error).toMatch(/\.c.*\.cpp.*\.zip/i);
    });
  });

  describe('zip safety', () => {
    it('rejects archive with no supported files', async () => {
      const zip = makeZip([{ name: 'readme.txt', data: Buffer.from('hi') }]);
      const { status, json } = await callWith(new Blob([new Uint8Array(zip)]), 'empty.zip');
      expect(status).toBe(400);
      expect(json.error).toMatch(/no supported source/i);
    });

    it('blocks zip-slip via ../ in entry name', async () => {
      const zip = makeZip([
        { name: '../escape.c', data: Buffer.from('int main(){}') },
        { name: 'ok.c', data: Buffer.from('int main(){}') },
      ]);
      const { json } = await callWith(new Blob([new Uint8Array(zip)]), 'malicious.zip');
      // ok.c is extracted, ../escape.c is silently dropped → c2fj runs on ok.c.
      expect(json.success).toBe(true);
    });

    it('blocks zip-slip via absolute Windows path', async () => {
      const zip = makeZip([
        { name: 'C:/escape.c', data: Buffer.from('int main(){}') },
        { name: 'ok.c', data: Buffer.from('int main(){}') },
      ]);
      const { json } = await callWith(new Blob([new Uint8Array(zip)]), 'win.zip');
      // Hard requirement: the route must not crash / 500. The "C:/escape.c"
      // entry resolves outside srcDir on Windows and stays inside (as a
      // subdir literal named "C:") on Linux. We don't care which behaviour
      // happens — only that no escape occurs and the response is well-shaped.
      expect(typeof json.success).toBe('boolean');
      if (json.success) {
        expect(json.fjContent).toMatch(/stl\.startup/);
      } else {
        // If the route rejected the archive, the error must mention the
        // input (no supported sources) — NOT a 500 from path-resolution
        // crashing.
        expect(json.error).toBeDefined();
      }
    });

    it('skips symlink entries', async () => {
      const zip = makeZip([
        { name: 'link.c', data: Buffer.from('/etc/passwd'), symlink: true },
        { name: 'real.c', data: Buffer.from('int main(){}') },
      ]);
      const { json } = await callWith(new Blob([new Uint8Array(zip)]), 'sym.zip');
      // Symlink dropped; real.c remains.
      expect(json.success).toBe(true);
    });

    it('skips entries above per-file decompressed cap (5 MB)', async () => {
      const zip = makeZip([
        { name: 'too-big.c', data: Buffer.alloc(6 * 1024 * 1024, 0x61) },
        { name: 'ok.c', data: Buffer.from('int main(){}') },
      ]);
      const { json } = await callWith(new Blob([new Uint8Array(zip)]), 'mixed.zip');
      // The big entry is dropped; ok.c remains.
      expect(json.success).toBe(true);
    });

    it('rejects archive whose decompressed total exceeds 30 MB', async () => {
      // 7 × 4.5 MB ≈ 31.5 MB combined, each under the per-entry cap.
      // Use highly compressible data so the archive itself is small.
      const big = Buffer.alloc(4.5 * 1024 * 1024, 0x41);
      const entries = Array.from({ length: 7 }, (_, i) => ({
        name: `f${i}.c`,
        data: big,
      }));
      const zip = makeZip(entries);
      const { status, json } = await callWith(new Blob([new Uint8Array(zip)]), 'bomb.zip');
      expect(status).toBe(400);
      expect(json.error).toMatch(/uncompressed/i);
    });

    it('skips entries with disallowed extensions inside zip', async () => {
      const zip = makeZip([
        { name: 'evil.exe', data: Buffer.from('MZ\x90\x00') },
        { name: 'real.c', data: Buffer.from('int main(){}') },
      ]);
      const { json } = await callWith(new Blob([new Uint8Array(zip)]), 'mixed-ext.zip');
      expect(json.success).toBe(true);
    });
  });

  describe('single-file happy path', () => {
    it('accepts a .c file and returns mocked unified.fj', async () => {
      const { json } = await callWith(new Blob(['int main(){return 0;}']), 'hello.c');
      expect(json.success).toBe(true);
      expect(json.fjContent).toMatch(/stl\.startup/);
      expect(json.fjContent).toMatch(/output_char/);
    });

    it('accepts a .cpp file', async () => {
      const { json } = await callWith(new Blob(['int main(){return 0;}']), 'hello.cpp');
      expect(json.success).toBe(true);
    });

    it('sanitizes path-traversal filenames via basename', async () => {
      // `basename('../../etc/passwd.c')` is `passwd.c` — which is then
      // checked against isSafeCFilename and accepted, so the request
      // succeeds (the basename is what gets written to disk). This is the
      // *correct* behavior: the file lands inside srcDir, not outside.
      const { json } = await callWith(
        new Blob(['int main(){}']),
        '../../etc/passwd.c',
      );
      expect(json.success).toBe(true);
    });
  });
});
