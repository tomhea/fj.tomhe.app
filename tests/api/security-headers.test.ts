import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function callMiddleware(url = 'http://localhost/') {
  return middleware(new NextRequest(url));
}

describe('security headers (middleware)', () => {
  it('sets X-Frame-Options: DENY', () => {
    expect(callMiddleware().headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('sets Referrer-Policy: no-referrer', () => {
    expect(callMiddleware().headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('sets X-Content-Type-Options: nosniff', () => {
    expect(callMiddleware().headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets Strict-Transport-Security with a long max-age', () => {
    const hsts = callMiddleware().headers.get('Strict-Transport-Security') ?? '';
    expect(hsts).toContain('max-age=');
    // Verify the max-age value is at least 1 year (31 536 000 s).
    const match = hsts.match(/max-age=(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(31_536_000);
  });

  it('CSP contains frame-ancestors none', () => {
    const csp = callMiddleware().headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('CSP contains self in script-src', () => {
    const csp = callMiddleware().headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("script-src 'self'");
  });

  it('CSP contains base-uri self (prevents base-tag hijacking)', () => {
    const csp = callMiddleware().headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("base-uri 'self'");
  });

  it('CSP contains form-action self', () => {
    const csp = callMiddleware().headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("form-action 'self'");
  });

  it('Permissions-Policy disables camera, microphone, and geolocation', () => {
    const pp = callMiddleware().headers.get('Permissions-Policy') ?? '';
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
  });

  it('non-production CSP includes unsafe-eval (confirms production test exercises a distinct branch)', () => {
    const csp = callMiddleware().headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("'unsafe-eval'");
  });

  it('sets Cache-Control: no-store on /api/* responses (G3)', () => {
    expect(callMiddleware('http://localhost/api/compile').headers.get('Cache-Control')).toBe('no-store');
    expect(callMiddleware('http://localhost/api/bf2fj').headers.get('Cache-Control')).toBe('no-store');
    expect(callMiddleware('http://localhost/api/c2fj').headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not force Cache-Control on non-API paths (G3)', () => {
    const r = callMiddleware('http://localhost/');
    expect(r.headers.get('Cache-Control')).not.toBe('no-store');
  });

  it('production CSP does not include unsafe-eval', async () => {
    // isProd is a module-level constant evaluated at import time.
    // Stub the env FIRST so the value is set before the module initialises,
    // then reset the registry so the next import re-runs module-level code.
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    try {
      const { middleware: prodMiddleware } = await import('@/middleware');
      const csp = prodMiddleware(new NextRequest('http://localhost/')).headers.get(
        'Content-Security-Policy',
      ) ?? '';
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).toContain("script-src 'self'");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
