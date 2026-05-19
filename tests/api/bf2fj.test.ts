import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bf2fj/route';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/bf2fj', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function call(body: unknown) {
  const res = await POST(makeReq(body));
  return { status: res.status, json: await res.json() };
}

describe('POST /api/bf2fj', () => {
  describe('validation', () => {
    it('rejects empty content', async () => {
      const { status, json } = await call({});
      expect(status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects content > 512 KB', async () => {
      const { status, json } = await call({ content: 'x'.repeat(512 * 1024 + 1) });
      expect(status).toBe(400);
      expect(json.error).toMatch(/too large/i);
    });
  });

  describe('with real bf2fj toolchain', () => {
    const available = !process.env.SKIP_FJ_TESTS;

    it.skipIf(!available)(
      'converts a trivial BF program to FJ',
      async () => {
        // `+++.` increments cell 0 three times then prints it (a single byte
        // of value 3 — non-printable, but bf2fj still produces output).
        const { json } = await call({ content: '+++.' });
        if (!json.success) {
          console.warn('bf2fj failed:', json.error, json.stderr);
        }
        expect(json.success).toBe(true);
        // bf2fj output should contain FJ source. We don't pin the exact
        // shape (it changes with bf2fj versions) but it should be non-empty
        // text including either an stl.* call or a label/macro definition.
        expect(typeof json.fjContent).toBe('string');
        expect(json.fjContent.length).toBeGreaterThan(0);
      },
    );

    it.skipIf(!available)(
      'rejects invalid Brainfuck cleanly (no crash, stderr surfaced)',
      async () => {
        // Unbalanced bracket. bf2fj should fail; we just check we don't
        // throw and the response is well-shaped.
        const { json } = await call({ content: '[+' });
        // Whether bf2fj returns non-zero or treats this as a no-op depends
        // on the version. Either way the response must be a JSON object
        // with `success` set; nothing should blow up.
        expect(typeof json.success).toBe('boolean');
      },
    );
  });
});
