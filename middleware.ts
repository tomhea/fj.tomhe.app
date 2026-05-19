import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers — applied to every response.
 *
 * Production CSP is strict: same-origin scripts + the jsdelivr CDN that
 * `@monaco-editor/react` loads `vs/loader.js` from. Allowing jsdelivr is
 * the pragmatic choice for shipping today; self-hosting Monaco
 * (`monaco-editor` package + `loader.config({ paths: { vs: '/monaco/vs' } })`)
 * would remove the third-party origin entirely and is tracked as a
 * post-deploy follow-up.
 *
 * Development CSP also includes `'unsafe-eval'` because Next.js's HMR /
 * webpack runtime loads chunks via `eval()` / `new Function()`. Without
 * that, dynamic imports (including the IDE's `dynamic({ ssr: false })`)
 * silently hang at the loading fallback.
 *
 * `'unsafe-inline'` for style-src is required by Monaco in both modes —
 * it sets inline style attributes for syntax highlighting at runtime.
 *
 * `connect-src` includes `ws:`/`wss:` for the runner WebSocket; deploys
 * at a different host can extend via $ALLOWED_ORIGINS.
 */
const isProd = process.env.NODE_ENV === 'production';

// Single source of truth for the Monaco-loader CDN. If you self-host
// Monaco (see header comment), drop this constant and the corresponding
// entries in script-src / connect-src.
const MONACO_CDN = 'https://cdn.jsdelivr.net';

const ALLOWED_CONNECT = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .flatMap((o) => [o, o.replace(/^http/, 'ws')])
  .join(' ');

const SCRIPT_SRC = isProd
  ? `script-src 'self' 'unsafe-inline' ${MONACO_CDN}`
  : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${MONACO_CDN}`;

const CSP = [
  "default-src 'self'",
  SCRIPT_SRC,
  `style-src 'self' 'unsafe-inline' ${MONACO_CDN}`,
  "img-src 'self' data: blob:",
  `font-src 'self' data: ${MONACO_CDN}`,
  `connect-src 'self' ws: wss: ${MONACO_CDN} ${ALLOWED_CONNECT}`.trim(),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(_req: NextRequest) {
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
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|stl/).*)'],
};