/**
 * Generic web-security baseline tests — not FlipJump-specific.
 * Verify that API routes export only POST (Next.js App Router returns 405
 * automatically for any method not exported by the route module).
 */
import { describe, it, expect } from 'vitest';

const HTTP_METHODS = ['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD'] as const;

describe('API routes export only POST (G1)', () => {
  it.each(HTTP_METHODS)('/api/compile does not export %s', async (method) => {
    const mod = await import('@/app/api/compile/route');
    expect((mod as Record<string, unknown>)[method]).toBeUndefined();
  });

  it.each(HTTP_METHODS)('/api/bf2fj does not export %s', async (method) => {
    const mod = await import('@/app/api/bf2fj/route');
    expect((mod as Record<string, unknown>)[method]).toBeUndefined();
  });

  it.each(HTTP_METHODS)('/api/c2fj does not export %s', async (method) => {
    const mod = await import('@/app/api/c2fj/route');
    expect((mod as Record<string, unknown>)[method]).toBeUndefined();
  });
});
