// Allowed user-supplied filenames for the compile/run APIs.
// First char must be alphanumeric/underscore (no leading dot).
// Rest may include dots, underscores, alphanumerics (no spaces, no dashes).
// Must end with .fj (case-insensitive). No `..` segments. No Windows reserved names.
const SAFE_FJ_NAME = /^[\w][\w.]*\.fj$/i;
// Windows reserved device names (harmless on Linux, blocked for portability).
const WIN_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])\./i;

export function isSafeFilename(name: string): boolean {
  return SAFE_FJ_NAME.test(name) && !name.includes('..') && !WIN_RESERVED.test(name);
}

const SAFE_C_NAME = /^[\w][\w.]*\.(c|cpp|h|hpp|cc|hh|cxx|hxx)$/i;

export function isSafeCFilename(name: string): boolean {
  return SAFE_C_NAME.test(name) && !name.includes('..') && !WIN_RESERVED.test(name);
}
