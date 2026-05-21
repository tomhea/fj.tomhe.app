import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '@/lib/examples';
import { isSafeFilename } from '@/lib/safe-filename';

describe('EXAMPLES catalog', () => {
  it('contains Hello World and at least 10 entries', () => {
    const names = EXAMPLES.map((e) => e.name);
    expect(names).toContain('Hello World');
    expect(names).toContain('Prime Sieve');
    expect(names).toContain('Multi-file Compilation');
    expect(names.length).toBeGreaterThanOrEqual(10);
  });

  it.each(EXAMPLES.map((ex) => [ex.name, ex] as const))(
    '%s has a non-empty name, description, and at least one .fj file',
    (_name, ex) => {
      expect(ex.name.trim()).not.toBe('');
      expect(ex.description.trim()).not.toBe('');
      expect(ex.files.length).toBeGreaterThan(0);
      for (const f of ex.files) {
        // Filename must satisfy the same regex the server enforces.
        expect(isSafeFilename(f.name)).toBe(true);
        expect(f.content.length).toBeGreaterThan(0);
      }
    },
  );

  it.each(EXAMPLES.map((ex) => [ex.name, ex] as const))(
    '%s uses stl.* macros, not the old top-level shorthand',
    (_name, ex) => {
      const joined = ex.files.map((f) => f.content).join('\n');
      // The example must boot with stl.startup (or stl.startup_and_init_all) somewhere.
      expect(joined).toMatch(/\bstl\.startup(?:_and_init_all)?\b/);
      // Anti-regression: previous bad examples used `.startup main` and
      // top-level `output 'X'` / `halt`. Make sure those don't reappear.
      expect(joined).not.toMatch(/^\.startup\s+\w+/m);
      expect(joined).not.toMatch(/^\s*output\s+/m);
      expect(joined).not.toMatch(/^\s*halt\s*$/m);
      // Comments must be `//`, not `;`.
      expect(joined).not.toMatch(/^\s*;\s+[A-Z]/m);
    },
  );

  it('Hello World outputs the string "Hello, World!"', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Hello World')!;
    const src = ex.files[0].content;
    // The string should appear in an stl.output call
    expect(src).toMatch(/stl\.output[^;]*"Hello, World!/);
  });

  it('Calculator example is self-contained and includes the main loop and arithmetic ops', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Calculator')!;
    expect(ex.files.length).toBe(1);
    const src = ex.files[0].content;
    expect(src).toMatch(/\bstl\.startup\b/);
    expect(src).toMatch(/\bbit\.add\b/);
    expect(src).toMatch(/\bbit\.sub\b/);
    expect(src).toMatch(/\bstl\.loop\b/);
  });

  it('Prime Sieve example implements the Sieve of Eratosthenes and prints primes', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Prime Sieve')!;
    expect(ex.files.length).toBe(1);
    const src = ex.files[0].content;
    // Modern sieve uses startup_and_init_all instead of bare startup
    expect(src).toMatch(/\bstl\.startup(?:_and_init_all)?\b/);
    expect(src).toMatch(/\bbit\.print_dec_int\b/);
    expect(src).toMatch(/\bstl\.loop\b/);
  });

  it('Multi-file Compilation example spans multiple files with a library and entry point', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Multi-file Compilation')!;
    // May have more than 2 files (e.g. separate start.fj and end.fj files)
    expect(ex.files.length).toBeGreaterThanOrEqual(2);
    // greet.fj defines the library and must be first so later files can call it
    expect(ex.files[0].name).toBe('greet.fj');
    const joined = ex.files.map((f) => f.content).join('\n');
    expect(joined).toMatch(/\bdef\b/);
    expect(joined).toMatch(/\bstl\.startup\b/);
    expect(joined).toMatch(/mylib\.greet/);
  });
});
