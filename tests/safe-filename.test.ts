import { describe, it, expect } from 'vitest';
import { isSafeFilename, isSafeCFilename } from '@/lib/safe-filename';

describe('isSafeFilename', () => {
  const cases: Array<[string, boolean]> = [
    ['main.fj', true],
    ['my-file.fj', false],  // dashes not allowed
    ['my file.fj', false],  // spaces not allowed
    ['my.lib.fj', true],
    ['Main.FJ', true], // case-insensitive ext
    ['file_42.fj', true],

    ['', false],
    ['.fj', false],            // must start with [\w]
    ['.hidden.fj', false],
    ['-leading-dash.fj', false],
    [' leading-space.fj', false],
    ['../etc/passwd.fj', false],
    ['..fj', false],           // ".." substring rejected
    ['file..fj', false],       // ".." substring rejected
    ['foo;rm.fj', false],
    ['foo$x.fj', false],
    ['foo`x.fj', false],
    ['foo|bar.fj', false],
    ['foo<bar>.fj', false],
    ['foo\\bar.fj', false],
    ['foo/bar.fj', false],
    ['foo.fj.txt', false],
    ['foo.txt', false],
    ['foo', false],
  ];

  for (const [name, expected] of cases) {
    it(`${JSON.stringify(name)} → ${expected}`, () => {
      expect(isSafeFilename(name)).toBe(expected);
    });
  }
});

describe('isSafeCFilename', () => {
  const cases: Array<[string, boolean]> = [
    ['main.c', true],
    ['Main.C', true],
    ['header.h', true],
    ['lib.cpp', true],
    ['lib.cxx', true],
    ['lib.cc', true],
    ['lib.hpp', true],

    ['../main.c', false],
    ['main.fj', false],
    ['main.txt', false],
    ['', false],
    ['.c', false],
    // WIN_RESERVED cases
    ['CON.c', false],
    ['nul.cpp', false],
    ['COM1.h', false],
    ['LPT9.cc', false],
    ['PRN.cxx', false],
    ['conscript.c', true],   // not reserved — 'con' is just a prefix
    ['console.cpp', true],   // not reserved
    ['aCON.c', true],        // doesn't start with CON
    ['com0.c', true],        // COM0 is not a Windows reserved name
    ['lpt0.h', true],        // LPT0 is not a Windows reserved name
  ];

  for (const [name, expected] of cases) {
    it(`${JSON.stringify(name)} → ${expected}`, () => {
      expect(isSafeCFilename(name)).toBe(expected);
    });
  }
});
