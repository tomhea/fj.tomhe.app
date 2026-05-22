/**
 * Node-only helpers for the example .fjm cache.
 *
 * Kept separate from `lib/example-fjm-cache.ts` so Next.js's bundler doesn't
 * try to pull `fs` / `crypto` into the client bundle. Only the API route
 * (`/api/cached-compile`) and build / test scripts import this module.
 *
 * SECURITY: `resolveCachedFjmPath` is the single chokepoint that turns a
 * user-supplied slug into a filesystem path. It enforces:
 *   1. The slug shape matches a strict allowlist (no `..`, no separators).
 *   2. The slug is a known value in `manifest.json` (built at deploy time).
 *   3. The resolved absolute path is strictly under `public/example-fjms/`.
 *   4. The file actually exists on disk.
 * Any check failure returns `null` — the caller maps that to a 400.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';

type Files = ReadonlyArray<{ name: string; content: string }>;

const EXAMPLE_FJM_DIR = resolve(process.cwd(), 'public/example-fjms');

// Slug allowlist: lowercase alphanum + dashes, no leading/trailing dash,
// no consecutive dashes, length 1–80. Matches the output of `slugify`
// from `./example-fjm-cache.ts`.
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Node implementation of the content-only SHA-256 fingerprint. Used by
 * the build script (`scripts/build-example-index.ts`) and unit tests.
 * Returns lowercase hex (64 chars).
 *
 * Files are joined in *sorted* order (content only) — see
 * `fingerprintFilesBrowser` in `./example-fjm-cache.ts` for the matching
 * browser implementation.
 */
export function fingerprintFilesNode(files: Files): string {
  const sorted = [...files.map((f) => f.content)].sort();
  const joined = sorted.join('\0');
  return createHash('sha256').update(joined, 'utf8').digest('hex');
}

interface ManifestEntry {
  slug: string;
  name?: string;
  files?: Array<{ name: string; content: string }>;
}

type Manifest = Record<string, ManifestEntry>;

let manifestCache: { manifest: Manifest; slugs: Set<string> } | null = null;
let manifestLoadFailed = false;

/**
 * Load (and memoize) the server-side manifest. Returns null when the
 * manifest file is absent — that's a legitimate state on a fresh checkout
 * before `tsx scripts/build-example-index.ts` runs. The cached-compile
 * route maps this to a 400 and the client falls back to /api/compile.
 */
export async function loadManifest(): Promise<{
  manifest: Manifest;
  slugs: Set<string>;
} | null> {
  if (manifestCache) return manifestCache;
  if (manifestLoadFailed) return null;
  try {
    const raw = await fs.readFile(
      join(EXAMPLE_FJM_DIR, 'manifest.json'),
      'utf8',
    );
    const manifest = JSON.parse(raw) as Manifest;
    const slugs = new Set<string>();
    for (const entry of Object.values(manifest)) {
      if (entry && typeof entry.slug === 'string') slugs.add(entry.slug);
    }
    manifestCache = { manifest, slugs };
    return manifestCache;
  } catch {
    manifestLoadFailed = true;
    return null;
  }
}

/**
 * Test-only — reset the memoized manifest.
 */
export function __resetManifestCacheForTests(): void {
  manifestCache = null;
  manifestLoadFailed = false;
}

/**
 * Validate a user-supplied slug and return the absolute path to its `.fjm`,
 * or null if anything fails. Layered checks:
 *   1. Shape: matches SAFE_SLUG.
 *   2. Membership: slug is in the manifest (which lists only built-in
 *      examples, generated at deploy time from `EXAMPLES`).
 *   3. Containment: resolved absolute path is under `public/example-fjms/`
 *      (defense in depth — step 1 already rejects `..` and separators).
 *   4. Existence: `fs.access` confirms the file is on disk.
 */
export async function resolveCachedFjmPath(slug: unknown): Promise<string | null> {
  if (typeof slug !== 'string') return null;
  if (!SAFE_SLUG.test(slug)) return null;

  const m = await loadManifest();
  if (!m) return null;
  if (!m.slugs.has(slug)) return null;

  const abs = resolve(EXAMPLE_FJM_DIR, `${slug}.fjm`);
  // Step 3: containment check. After resolve(), abs must start with the
  // directory + path separator. Without this a clever slug couldn't
  // actually escape because SAFE_SLUG already rejects `..` / `/` / `\`,
  // but the check is cheap and documents intent.
  if (!abs.startsWith(EXAMPLE_FJM_DIR + sep)) return null;

  try {
    await fs.access(abs);
  } catch {
    return null;
  }
  return abs;
}
