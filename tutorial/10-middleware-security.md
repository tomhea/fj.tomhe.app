# Chapter 10 — Middleware & Security Headers

> **Previous:** [Chapter 9 — TypeScript](09-typescript.md) | **Next:** [Chapter 11 — Testing](11-testing.md)

---

In Chapter 7 you saw an API route handle *one* request. But some logic should run on **every** request — before any page or API route. In Next.js that's **middleware**: a single function, `middleware.ts`, that runs at the edge of the app and can inspect or modify every request and response.

This IDE uses it for one job: attaching **security headers**. These are instructions the server sends with every response telling the browser how to protect the user. Get them wrong and the app is open to attacks like cross-site scripting and clickjacking; get them right and the browser enforces a strict sandbox for you.

---

## Headers on every response

The middleware function takes the outgoing response and sets a header for each protection:

```ts
// middleware.ts
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
```

Each line is a defence:

- **Strict-Transport-Security** — forces HTTPS for a year, so the site can't be downgraded to plain HTTP.
- **X-Content-Type-Options: nosniff** — stops the browser guessing a file's type (a classic XSS vector).
- **X-Frame-Options: DENY** — no one can embed the site in an `<iframe>`, defeating clickjacking.
- **Referrer-Policy: no-referrer** — don't leak the current URL to other sites.
- **Permissions-Policy** — explicitly switch off camera, microphone and geolocation; this app needs none.
- **Cache-Control: no-store** on `/api/` — API responses are never cached.

---

## Content-Security-Policy: the big one

CSP is the strictest header — it whitelists exactly where scripts, styles, fonts and connections may come from. Anything not listed is blocked by the browser:

```ts
// middleware.ts
const CSP = [
  "default-src 'self'",
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ws: wss: ${ALLOWED_CONNECT}`.trim(),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
```

Notice `connect-src` allows `ws:` and `wss:` — that's what permits the WebSocket from Chapter 8 to connect. Without it the browser would block the runner connection.

---

## Different rules for development vs production

Some allowances are only safe in development. The CSP's script rule changes based on the environment:

```ts
// middleware.ts
const isProd = process.env.NODE_ENV === 'production';

const SCRIPT_SRC = isProd
  ? `script-src 'self' 'unsafe-inline'`
  : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`;
```

`'unsafe-eval'` lets Next.js's hot-reloader run during development, but it's a security risk — so production drops it. Same idea for which hosts may open WebSockets: that list comes from an environment variable, not hard-coded:

```ts
// middleware.ts — read deploy hosts from the environment
const ALLOWED_CONNECT = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .flatMap((o) => [o, o.replace(/^http/, 'ws')])
  .join(' ');
```

`.env.example` documents the knob so each deploy can set its own origins:

```bash
# .env.example
# ALLOWED_ORIGINS=https://example.com,https://staging.example.com
```

---

## Validating untrusted input

Headers protect the browser; the *server* still has to defend itself against whatever a user uploads. Remember the API route from Chapter 7 wrote user files to disk — so it first checks every filename against a strict allowlist:

```ts
// lib/safe-filename.ts
const SAFE_FJ_NAME = /^[\w][\w.]*\.fj$/i;
const WIN_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])\./i;

export function isSafeFilename(name: string): boolean {
  return SAFE_FJ_NAME.test(name) && !name.includes('..') && !WIN_RESERVED.test(name);
}
```

That regex rejects `../etc/passwd.fj`, names with spaces or shell characters, and Windows reserved device names — closing off path-traversal attacks before a file is ever written.

The same caution applies to what's sent *back*. The compiler's errors can contain server filesystem paths, so they're scrubbed before reaching the browser:

```ts
// lib/sanitize-stderr.ts — drop Python traceback frames, keep the message
if (/^\s+File "\//.test(line)) return false;
if (line.trimEnd() === 'Traceback (most recent call last):') return false;
```

The user still sees the real error (`FlipJumpError: unknown label 'x'`) — just not the server's internal paths.

---

## Key takeaways

- Middleware runs on *every* request, before pages and API routes — the right place for cross-cutting concerns like security headers.
- Six headers (HSTS, CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) plus `Cache-Control: no-store` on the API form the browser-side defence.
- CSP whitelists where scripts/styles/connections may come from; `connect-src ws: wss:` is what lets Chapter 8's WebSocket work.
- Risky allowances (`'unsafe-eval'`) are dev-only; deploy-specific values like allowed origins come from environment variables, not hard-coded.
- The server validates untrusted input itself: `isSafeFilename` blocks path-traversal before writing files, and `sanitizeStderr` strips server paths from errors sent back.

---

> **Next:** [Chapter 11 — Testing](11-testing.md)
