import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '@/lib/examples';
import { isSafeFilename } from '@/lib/safe-filename';

describe('EXAMPLES catalog', () => {
  it('contains at least Hello World, Multi-file, and one digit example', () => {
    const names = EXAMPLES.map((e) => e.name);
    expect(names).toContain('Hello World');
    expect(names).toContain('Multi-file');
    expect(names.length).toBeGreaterThanOrEqual(3);
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
      // The example must boot with stl.startup somewhere.
      expect(joined).toMatch(/\bstl\.startup\b/);
      // Anti-regression: previous bad examples used `.startup main` and
      // top-level `output 'X'` / `halt`. Make sure those don't reappear.
      expect(joined).not.toMatch(/^\.startup\s+\w+/m);
      expect(joined).not.toMatch(/^\s*output\s+/m);
      expect(joined).not.toMatch(/^\s*halt\s*$/m);
      // Comments must be `//`, not `;`.
      expect(joined).not.toMatch(/^\s*;\s+[A-Z]/m);
    },
  );

  it('Hello World prints all 13 characters of "Hello, World!" plus a newline', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Hello World')!;
    const src = ex.files[0].content;
    // Each visible char of "Hello, World!" appears once in an
    // output_char call, plus one newline.
    const expectedChars = 'Hello, World!';
    for (const ch of expectedChars) {
      const escaped = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(src).toMatch(new RegExp(`output_char\\s+'${escaped}'`));
    }
    expect(src).toMatch(/output_char\s+'\\n'/);
  });

  it('Multi-file example has two files, one defining a namespace, one calling it', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Multi-file')!;
    expect(ex.files.length).toBe(2);
    const lib = ex.files.find((f) => /^ns\s+\w+\s*\{/m.test(f.content));
    const main = ex.files.find((f) => /\bstl\.startup\b/.test(f.content));
    expect(lib).toBeDefined();
    expect(main).toBeDefined();
    // main calls into the namespace
    expect(main!.content).toMatch(/\bgreet\.say_hi\b/);
  });
});
