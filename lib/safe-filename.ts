// Allowed user-supplied filenames for the compile/run APIs.
// First char must be alphanumeric/underscore (no leading dot, no leading dash).
// Rest may include spaces, dots, dashes, underscores, alphanumerics.
// Must end with .fj (case-insensitive). No `..` segments.
const SAFE_FJ_NAME = /^[\w][\w. -]*\.fj$/i;

export function isSafeFilename(name: string): boolean {
  return SAFE_FJ_NAME.test(name) && !name.includes('..');
}

const SAFE_C_NAME = /^[\w][\w. -]*\.(c|cpp|h|hpp|cc|hh|cxx|hxx)$/i;

export function isSafeCFilename(name: string): boolean {
  return SAFE_C_NAME.test(name) && !name.includes('..');
}
