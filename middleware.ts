import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers — applied to every response.
 *
 * Monaco is self-hosted: `scripts/copy-monaco.js` copies `monaco-editor/min/vs`
 * into `public/monaco-vs/` at install time, and `CodeEditor.tsx` points the AMD
 * loader at `/monaco-vs` via `loader.config({ paths: { vs: '/monaco-vs' } })`.
 * No CDN allowances are needed in CSP.
 *
 * Development CSP includes `'unsafe-eval'` because Next.js's HMR / webpack
 * runtime loads chunks via `eval()` / `new Function()`. Without it, dynamic
 * imports (including the IDE's `dynamic({ ssr: false })`) silently hang.
 *
 * `'unsafe-inline'` for style-src is required by Monaco — it sets inline style
 * attributes for syntax highlighting at runtime.
 * `'unsafe-inline'` for script-src is required by Next.js's bootstrap inline
 * scripts. Tracked for removal via nonce-based CSP.
 *
 * `connect-src` includes `ws:`/`wss:` for the runner WebSocket; deploys at a
 * different host can extend via $ALLOWED_ORIGINS.
 */
const isProd = process.env.NODE_ENV === 'production';

const ALLOWED_CONNECT = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .flatMap((o) => [o, o.replace(/^http/, 'ws')])
  .join(' ');

const SCRIPT_SRC = isProd
  ? `script-src 'self' 'unsafe-inline'`
  : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`;

const CSP = [
  "default-src 'self'",
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ws: wss: https://spoo.me ${ALLOWED_CONNECT}`.trim(),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  );
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  if (req.nextUrl.pathname.startsWith('/api/')) {
    res.headers.set('Cache-Control', 'no-store');
  }
  return res;
}

export const config = {
  // Exclude: Next.js internals, static image optimiser, favicon, the STL
  // browser endpoint, and the self-hosted Monaco min/vs bundle (large static
  // assets that don't need security headers added per-request).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|stl/|monaco-vs/).*)'],
};