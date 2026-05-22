import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  buildCachedStderr,
  slugify,
} from '@/lib/example-fjm-cache';
import {
  fingerprintFilesNode,
  resolveCachedFjmPath,
} from '@/lib/example-fjm-cache-node';
import { EXAMPLES } from '@/lib/examples';

const MANIFEST_PATH = join(process.cwd(), 'public/example-fjms/manifest.json');
const manifestExists = existsSync(MANIFEST_PATH);

describe('fingerprintFilesNode', () => {
  it('is content-only — filenames are ignored', () => {
    const a = fingerprintFilesNode([{ name: 'foo.fj', content: 'hello' }]);
    const b = fingerprintFilesNode([{ name: 'bar.fj', content: 'hello' }]);
    expect(a).toBe(b);
  });

  it('is order-independent across files', () => {
    const a = fingerprintFilesNode([
      { name: 'a.fj', content: 'first' },
      { name: 'b.fj', content: 'second' },
    ]);
    const b = fingerprintFilesNode([
      { name: 'b.fj', content: 'second' },
      { name: 'a.fj', content: 'first' },
    ]);
    expect(a).toBe(b);
  });

  it('detects a one-byte change in content', () => {
    const a = fingerprintFilesNode([{ name: 'x.fj', content: 'hello world' }]);
    const b = fingerprintFilesNode([{ name: 'x.fj', content: 'hello worle' }]);
    expect(a).not.toBe(b);
  });

  it('returns lowercase hex SHA-256 (64 chars)', () => {
    const h = fingerprintFilesNode([{ name: 'x.fj', content: 'abc' }]);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('buildCachedStderr', () => {
  it('returns exactly four phase lines, each matching the (cached) format', () => {
    const out = buildCachedStderr();
    const lines = out.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      // Two leading spaces, label words, colon, whitespace, "0.0NNs (cached)".
      expect(line).toMatch(/^ {2}[\w ]+:\s+0\.0\d\ds \(cached\)$/);
    }
  });

  it('includes all four real fj --asm phase labels', () => {
    const out = buildCachedStderr();
    expect(out).toContain('parsing:');
    expect(out).toContain('macro resolve:');
    expect(out).toContain('labels resolve:');
    expect(out).toContain('create binary:');
  });

  it('produces varying values across calls (probabilistic)', () => {
    // With 21^4 = ~194_481 possible 4-tuples, ten draws almost always have
    // at least one differing tuple. Probability of all ten being identical:
    // (1/194_481)^9 ≈ 10^-50.
    const samples = new Set<string>();
    for (let i = 0; i < 10; i++) samples.add(buildCachedStderr());
    expect(samples.size).toBeGreaterThan(1);
  });
});

describe('slugify', () => {
  it('strips emoji and lowercases', () => {
    expect(slugify('🚀 Prime Sieve')).toBe('prime-sieve');
  });

  it('replaces non-alphanumeric runs with single dashes', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('Multi-file  Compilation')).toBe('multi-file-compilation');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('---foo---')).toBe('foo');
  });
});

describe('resolveCachedFjmPath (path safety)', () => {
  it('rejects path-traversal slugs', async () => {
    expect(await resolveCachedFjmPath('../etc/passwd')).toBeNull();
    expect(await resolveCachedFjmPath('..')).toBeNull();
  });

  it('rejects slugs with path separators', async () => {
    expect(await resolveCachedFjmPath('foo/bar')).toBeNull();
    expect(await resolveCachedFjmPath('foo\\bar')).toBeNull();
  });

  it('rejects slugs with disallowed characters', async () => {
    expect(await resolveCachedFjmPath('foo bar')).toBeNull();
    expect(await resolveCachedFjmPath('foo$bar')).toBeNull();
    expect(await resolveCachedFjmPath('foo;bar')).toBeNull();
    expect(await resolveCachedFjmPath('')).toBeNull();
  });

  it('rejects slugs that look like .fj files', async () => {
    expect(await resolveCachedFjmPath('foo.fj')).toBeNull();
  });

  it.skipIf(!manifestExists)(
    'rejects safe-looking but unknown slugs (not in manifest)',
    async () => {
      expect(await resolveCachedFjmPath('definitely-not-a-real-slug-xyz')).toBeNull();
    },
  );

  it.skipIf(!manifestExists)(
    'returns an absolute path for a known slug whose file exists',
    async () => {
      const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<
        string,
        { slug: string }
      >;
      const firstSlug = Object.values(manifest)[0]?.slug;
      if (!firstSlug) return;
      const abs = await resolveCachedFjmPath(firstSlug);
      if (abs === null) {
        // Manifest entry exists but the .fjm hasn't been built yet (CI
        // without fj). Acceptable; the API will fall back to /api/compile.
        return;
      }
      expect(abs.startsWith(process.cwd())).toBe(true);
      expect(abs.endsWith(`${firstSlug}.fjm`)).toBe(true);
    },
  );
});

describe.skipIf(!manifestExists)('manifest integrity', () => {
  it('every EXAMPLES entry hashes to a key in the manifest', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<
      string,
      { slug: string }
    >;
    for (const ex of EXAMPLES) {
      const hash = fingerprintFilesNode(ex.files);
      expect(
        manifest[hash],
        `EXAMPLES "${ex.name}" (hash ${hash}) missing from manifest`,
      ).toBeDefined();
    }
  });
});
