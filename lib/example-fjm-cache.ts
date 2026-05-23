/**
 * Helpers for the "cached `.fjm` for built-in examples" feature.
 *
 * The client hashes the current file set (content-only) and, if the hash
 * matches a baked-in index produced by `scripts/build-example-index.ts`,
 * calls `/api/cached-compile` to fetch a pre-built `.fjm` plus four canned
 * `(cached)` timing lines. On any failure we fall back to `/api/compile`.
 *
 * THIS FILE IS CLIENT-SAFE — no Node-only imports. The Node-only helpers
 * (`fingerprintFilesNode`, `resolveCachedFjmPath`, `loadManifest`) live in
 * `lib/example-fjm-cache-node.ts` so Next.js's bundler can keep them out of
 * the client bundle.
 *
 * VERIFIED — phase labels in `buildCachedStderr` match the exact output of
 * `fj --asm` (as of 2026-05-22, flipjump installed via `pip install`).
 * Captured by piping a Hello-World fj file through `fj --asm` and copying
 * the four stderr lines verbatim — same labels, same column alignment,
 * same trailing 's'.
 *
 * VERIFIED — fingerprint is content-only and order-independent. Filenames
 * are intentionally ignored so renaming a file does not bust the cache.
 */

type Files = ReadonlyArray<{ name: string; content: string }>;

/**
 * Lowercase the name, replace any non-[a-z0-9] run with a single dash,
 * and trim leading/trailing dashes. Emojis and punctuation are stripped.
 *
 *   "🚀 Prime Sieve"       → "prime-sieve"
 *   "Multi-file Compilation" → "multi-file-compilation"
 *   "Hello, World!"         → "hello-world"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Browser implementation of the content-only SHA-256 fingerprint, using
 * SubtleCrypto. Returns lowercase hex (64 chars). Requires a secure context
 * (HTTPS or localhost) — both production and local dev satisfy that.
 *
 * Files are joined in *sorted* order (content only) so the hash is
 * independent of file order. Filenames are intentionally ignored.
 */
export async function fingerprintFilesBrowser(files: Files): Promise<string> {
  const sorted = [...files.map((f) => f.content)].sort();
  const joined = sorted.join('\0');
  const data = new TextEncoder().encode(joined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

const pad2 = (n: number) => n.toString().padStart(2, '0');
const rnd = () => Math.floor(Math.random() * 21); // 0..20 inclusive

/**
 * Build the canned stderr block returned by /api/cached-compile.
 *
 * Each call produces four independent random values formatted `0.0NNs`,
 * suffixed with `(cached)`. The four phase labels match what real
 * `fj --asm` prints today — kept in sync with the verification noted at
 * the top of this file.
 *
 * CONTRACT — load-bearing for IDE.tsx rendering:
 *   1. Every line starts with exactly two leading spaces. IDE.tsx uses
 *      `trimEnd()` (not `trim()`) so this indent reaches the terminal
 *      and the four lines column-align with `fj`'s real output.
 *   2. The block ends with a trailing `\n`; the consumer trims it.
 * If you change the leading-space prefix, also update IDE.tsx.
 */
export function buildCachedStderr(): string {
  return (
    `  parsing:         0.0${pad2(rnd())}s (cached)\n` +
    `  macro resolve:   0.0${pad2(rnd())}s (cached)\n` +
    `  labels resolve:  0.0${pad2(rnd())}s (cached)\n` +
    `  create binary:   0.0${pad2(rnd())}s (cached)\n`
  );
}

/**
 * The shape `scripts/build-example-index.ts` writes to
 * `lib/generated/example-fjm-index.ts`. Re-exported here so consumers
 * import a single client-safe module and never touch the generated file
 * directly for typing purposes.
 */
export type ExampleFjmIndex = Record<string, { slug: string }>;
