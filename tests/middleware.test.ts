import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

/**
 * Guard the CSP string against accidental regressions. Monaco is now
 * self-hosted from /monaco-vs, so no cdn.jsdelivr.net allowances are needed.
 */
function call(): Response {
  const req = new NextRequest('http://localhost/');
  return middleware(req);
}

describe('middleware CSP headers', () => {
  it('sets HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy', () => {
    const res = call();
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('permissions-policy')).toMatch(/camera=\(\)/);
  });

  describe('CSP directive contents', () => {
    const csp = call().headers.get('content-security-policy') ?? '';

    it('allows same-origin scripts (Monaco is self-hosted — no CDN needed)', () => {
      expect(csp).toMatch(/script-src[^;]+'self'/);
      expect(csp).not.toContain('cdn.jsdelivr.net');
    });

    it('allows same-origin stylesheets + fonts (Monaco is self-hosted)', () => {
      expect(csp).toMatch(/style-src[^;]+'self'/);
      expect(csp).toMatch(/font-src[^;]+'self'/);
      expect(csp).not.toContain('cdn.jsdelivr.net');
    });

    it('allows ws:/wss: for the runner WebSocket', () => {
      expect(csp).toMatch(/connect-src[^;]+ws:/);
      expect(csp).toMatch(/connect-src[^;]+wss:/);
    });

    it('allows worker-src blob: (Monaco loads its workers as blob URLs)', () => {
      expect(csp).toMatch(/worker-src[^;]+blob:/);
    });

    it('denies framing (clickjacking)', () => {
      expect(csp).toMatch(/frame-ancestors\s+'none'/);
    });

    it('restricts base-uri and form-action to same-origin', () => {
      expect(csp).toMatch(/base-uri\s+'self'/);
      expect(csp).toMatch(/form-action\s+'self'/);
    });

    it('does NOT use unsafe-eval in production', async () => {
      // Vitest runs with NODE_ENV=test. Re-import middleware with NODE_ENV=production
      // to exercise the prod-only CSP branch (no 'unsafe-eval').
      vi.stubEnv('NODE_ENV', 'production');
      vi.resetModules();
      const { middleware: prodMiddleware } = await import('@/middleware');
      const prodCsp =
        prodMiddleware(new NextRequest('http://localhost/')).headers.get(
          'content-security-policy',
        ) ?? '';
      expect(prodCsp).not.toMatch(/unsafe-eval/);
      vi.unstubAllEnvs();
      vi.resetModules();
    });
  });
});