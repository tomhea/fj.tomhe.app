/**
 * Build-time generator for the example cache index.
 *
 * Runs under `tsx` from `prebuild` / `predev`. Pure Node + crypto; the
 * `fj` toolchain is NOT required here. The `.fjm` binaries themselves are
 * built separately by `scripts/build-example-fjms.py` (which DOES need fj
 * and runs on the deploy host, where the venv is set up).
 *
 * Outputs:
 *   - lib/generated/example-fjm-index.ts  (client bundle, committed stub
 *     that this script overwrites; map of hash → {slug}).
 *   - public/example-fjms/manifest.json   (server-side validator + python
 *     builder input; map of hash → {slug, name, files}). Gitignored.
 *
 * Idempotent: writes only when output differs from current contents.
 */

import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Atomically read a file's contents, returning null if it doesn't exist.
 * Replaces the existsSync()+readFileSync() pattern that CodeQL flags as
 * a `js/file-system-race` TOCTOU window.
 */
function readIfExists(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}
import { EXAMPLES } from '../lib/examples';
import { slugify } from '../lib/example-fjm-cache';
import { fingerprintFilesNode } from '../lib/example-fjm-cache-node';

const ROOT = resolve(__dirname, '..');
const INDEX_PATH = join(ROOT, 'lib/generated/example-fjm-index.ts');
const MANIFEST_PATH = join(ROOT, 'public/example-fjms/manifest.json');

interface IndexEntry {
  slug: string;
}
interface ManifestEntry {
  slug: string;
  name: string;
  files: Array<{ name: string; content: string }>;
}

function build() {
  const index: Record<string, IndexEntry> = {};
  const manifest: Record<string, ManifestEntry> = {};
  const seenSlugs = new Set<string>();

  for (const ex of EXAMPLES) {
    const slug = slugify(ex.name);
    if (!slug) {
      throw new Error(`Example "${ex.name}" produced an empty slug`);
    }
    if (seenSlugs.has(slug)) {
      throw new Error(
        `Duplicate slug "${slug}" — examples must produce unique slugs`,
      );
    }
    seenSlugs.add(slug);

    const hash = fingerprintFilesNode(ex.files);
    if (index[hash]) {
      throw new Error(
        `Hash collision: examples "${ex.name}" and "${index[hash].slug}" share fingerprint ${hash}`,
      );
    }
    index[hash] = { slug };
    manifest[hash] = {
      slug,
      name: ex.name,
      files: ex.files.map((f) => ({ name: f.name, content: f.content })),
    };
  }

  // ─── lib/generated/example-fjm-index.ts ──────────────────────────────
  const sortedHashes = Object.keys(index).sort();
  const indexLines = [
    '/**',
    ' * GENERATED FILE — DO NOT EDIT BY HAND.',
    ' *',
    ' * Overwritten by `tsx scripts/build-example-index.ts` (runs in `prebuild` /',
    ' * `predev`). The committed stub guarantees fresh checkouts compile before',
    ' * the script has had a chance to run.',
    ' *',
    ' * Format: { [sha256hex of content-only fingerprint]: { slug } }',
    ' * See `lib/example-fjm-cache.ts` for the fingerprint algorithm.',
    ' */',
    '',
    "import type { ExampleFjmIndex } from '@/lib/example-fjm-cache';",
    '',
    'export const EXAMPLE_FJM_INDEX: ExampleFjmIndex = {',
    ...sortedHashes.map(
      (h) => `  '${h}': { slug: '${index[h].slug}' },`,
    ),
    '};',
    '',
  ];
  const indexContent = indexLines.join('\n');

  // `mkdirSync` with `recursive: true` is a no-op if the directory exists,
  // so the previous existsSync() guard was redundant — and dropping it also
  // removes a TOCTOU window flagged by CodeQL `js/file-system-race`.
  mkdirSync(dirname(INDEX_PATH), { recursive: true });
  const existingIndex = readIfExists(INDEX_PATH);
  if (existingIndex !== indexContent) {
    writeFileSync(INDEX_PATH, indexContent, 'utf8');
    process.stdout.write(`wrote ${INDEX_PATH}\n`);
  } else {
    process.stdout.write(`unchanged ${INDEX_PATH}\n`);
  }

  // ─── public/example-fjms/manifest.json ───────────────────────────────
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  // Stable key order so successive runs produce byte-identical JSON.
  const stableManifest: Record<string, ManifestEntry> = {};
  for (const h of sortedHashes) stableManifest[h] = manifest[h];
  const manifestContent = JSON.stringify(stableManifest, null, 2) + '\n';
  const existingManifest = readIfExists(MANIFEST_PATH);
  if (existingManifest !== manifestContent) {
    writeFileSync(MANIFEST_PATH, manifestContent, 'utf8');
    process.stdout.write(`wrote ${MANIFEST_PATH}\n`);
  } else {
    process.stdout.write(`unchanged ${MANIFEST_PATH}\n`);
  }

  process.stdout.write(
    `example index: ${sortedHashes.length} entries (slugs: ${[...seenSlugs].join(', ')})\n`,
  );
}

build();
