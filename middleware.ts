import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers — applied to every response.
 *
 * The IDE is a single-page app with no third-party scripts at runtime, so
 * the CSP can stay restrictive. WebSocket `connect-src` must include the
 * same origin (the runner is `/ws/run` on this host); the deploy admin
 * extends it via env if the IDE is moved to a different host.
 *
 * `'unsafe-inline'` for style-src is required by Monaco (it sets inline
 * style attributes for syntax highlighting at runtime). `'unsafe-eval'`
 * is NOT enabled — Monaco's runtime worker doesn't need it for our usage.
 */
const ALLOWED_CONNECT = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  // Convert http://x → ws://x and https://x → wss://x for the connect-src
  // list, since the IDE opens a WebSocket back to the same origin.
  .flatMap((o) => [o, o.replace(/^http/, 'ws')])
  .join(' ');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Monaco loads workers as blobs
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // 'self' (HTTPS + same origin) plus matching WS schemes. The browser
  // accepts wss:/ws: in connect-src.
  `connect-src 'self' ws: wss: ${ALLOWED_CONNECT}`.trim(),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  // Strict transport — only meaningful over HTTPS, but harmless on HTTP.
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  );
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export const config = {
  // Apply to every route except Next.js' own static assets + the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|stl/).*)'],
};