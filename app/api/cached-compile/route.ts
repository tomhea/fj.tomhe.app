/**
 * POST /api/cached-compile
 *
 * Returns a pre-built `.fjm` for one of the built-in examples plus a canned
 * `(cached)` stderr block. Validation chokepoint: `resolveCachedFjmPath` —
 * see `lib/example-fjm-cache.ts` for the full layered safety check.
 *
 * Client semantics: on any non-2xx (or network error), fall back to
 * `/api/compile`. That way a missing manifest / `.fjm` (e.g. a deploy that
 * finished rsync but crashed before the Python builder ran) degrades to a
 * normal compile rather than a hard error visible to the user.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { buildCachedStderr } from '@/lib/example-fjm-cache';
import { resolveCachedFjmPath } from '@/lib/example-fjm-cache-node';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 2 * 1024; // 2 KiB — body is `{"slug":"..."}`

export async function POST(req: NextRequest) {
  const lenHeader = req.headers.get('content-length');
  if (lenHeader !== null) {
    const len = Number(lenHeader);
    if (!Number.isFinite(len) || len < 0 || len > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Body too large.' },
        { status: 413 },
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON.' },
      { status: 400 },
    );
  }

  const slug =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>).slug
      : undefined;

  if (typeof slug !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing or non-string slug.' },
      { status: 400 },
    );
  }

  const abs = await resolveCachedFjmPath(slug);
  if (!abs) {
    return NextResponse.json(
      { success: false, error: 'Unknown or unavailable slug.' },
      { status: 400 },
    );
  }

  try {
    const buf = await readFile(abs);
    const fjmBase64 = buf.toString('base64');
    return NextResponse.json({
      success: true,
      fjmBase64,
      stderr: buildCachedStderr(),
    });
  } catch (err) {
    // Log the underlying error server-side; do NOT leak the absolute path
    // or `ENOENT`-style detail to the client.
    console.error('[cached-compile] readFile failed:', (err as Error).message);
    return NextResponse.json(
      { success: false, error: 'Failed to read cached .fjm.' },
      { status: 500 },
    );
  }
}
