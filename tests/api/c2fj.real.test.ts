/**
 * Opt-in integration test for the REAL `c2fj` toolchain.
 *
 * Skipped by default because `c2fj` requires `make` + a RISC-V cross-
 * compiler on PATH (kbuild + GCC), which we don't want to install in CI.
 * To run locally:
 *
 *   $env:RUN_REAL_C2FJ_TESTS = '1'   # PowerShell
 *   RUN_REAL_C2FJ_TESTS=1            # Unix
 *   npm test -- tests/api/c2fj.real.test.ts
 *
 * The mocked tests in `tests/api/c2fj.test.ts` cover the route's security
 * paths (zip-slip, symlink, decompressed caps, basename sanitization)
 * without needing the toolchain. This file complements those by proving
 * the route correctly invokes c2fj with the right `--build-dir / --unify-fj
 * / --finish-after fj` flags and reads back `unified.fj`.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';

// We deliberately do not vi.mock child_process here — this test exercises
// the real binary end-to-end against the route handler.
const runReal = !!process.env.RUN_REAL_C2FJ_TESTS;
const c2fjAvailable = runReal && (() => {
  try {
    // execFileSync — see compile.test.ts for the
    // `js/indirect-command-line-injection` rationale.
    execFileSync(process.env.C2FJ_CMD ?? 'c2fj', ['--help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!c2fjAvailable)('POST /api/c2fj — real c2fj toolchain', () => {
  it('compiles a trivial C program to FlipJump source', async () => {
    // Lazy import so the route module isn't loaded (and child_process
    // isn't mocked) unless this gated suite actually runs.
    const { POST } = await import('@/app/api/c2fj/route');

    const tinyC = 'int main(void) { return 0; }\n';
    const fd = new FormData();
    fd.append('file', new Blob([tinyC]), 'tiny.c');
    const req = new Request('http://localhost/api/c2fj', { method: 'POST', body: fd });

    const res = await POST(req as never);
    const json = await res.json();

    if (!json.success) {
      // Surface the real c2fj stderr so failures point at the toolchain
      // instead of looking like a test bug.
      console.warn('c2fj failed:', json.error, json.stderr);
    }
    expect(json.success).toBe(true);
    expect(typeof json.fjContent).toBe('string');
    expect(json.fjContent.length).toBeGreaterThan(0);
    // The unified output should reference stl. macros somewhere.
    expect(json.fjContent).toMatch(/stl\./);
  }, 180_000); // c2fj is slow — give it 3 minutes
});