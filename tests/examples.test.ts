import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '@/lib/examples';
import { isSafeFilename } from '@/lib/safe-filename';

describe('EXAMPLES catalog', () => {
  it('contains Hello World and at least 8 entries', () => {
    const names = EXAMPLES.map((e) => e.name);
    expect(names).toContain('Hello World');
    expect(names.length).toBeGreaterThanOrEqual(8);
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
});
