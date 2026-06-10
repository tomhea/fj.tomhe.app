import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for the opt-in subprocess memory cap. The behaviour is driven by
 * `FJ_MEMORY_LIMIT_KB` + the host platform, both read at module load — so each
 * case stubs the env/platform and re-imports the module fresh.
 */
async function load(platformValue: string, limitKb?: string) {
  vi.resetModules();
  vi.doMock('os', async (orig) => {
    const actual = await orig<typeof import('os')>();
    return { ...actual, platform: () => platformValue };
  });
  if (limitKb === undefined) vi.stubEnv('FJ_MEMORY_LIMIT_KB', '');
  else vi.stubEnv('FJ_MEMORY_LIMIT_KB', limitKb);
  const mod = await import('@/lib/resource-limit');
  return mod.withResourceLimit;
}

describe('withResourceLimit', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('os');
    vi.resetModules();
  });

  it('passes the command through unchanged when the limit is unset', async () => {
    const withResourceLimit = await load('linux', undefined);
    const spec = withResourceLimit('fj', ['--asm', 'a.fj']);
    expect(spec).toEqual({ cmd: 'fj', args: ['--asm', 'a.fj'] });
  });

  it('passes through unchanged when the limit is zero or negative', async () => {
    expect(await (await load('linux', '0'))('fj', ['x'])).toEqual({ cmd: 'fj', args: ['x'] });
    expect(await (await load('linux', '-5'))('fj', ['x'])).toEqual({ cmd: 'fj', args: ['x'] });
  });

  it('never wraps on non-Linux (no prlimit) even when a limit is set', async () => {
    // prlimit is util-linux — absent on Windows and macOS, so the cap is a
    // no-op there and the command runs unwrapped.
    expect(await (await load('win32', '2000000'))('fj', ['x'])).toEqual({ cmd: 'fj', args: ['x'] });
    expect(await (await load('darwin', '2000000'))('fj', ['x'])).toEqual({ cmd: 'fj', args: ['x'] });
  });

  it('wraps in a shell-free prlimit invocation on Linux when set', async () => {
    const withResourceLimit = await load('linux', '2000000');
    const spec = withResourceLimit('fj', ['--run', '/tmp/p.fjm']);
    expect(spec.cmd).toBe('prlimit');
    // prlimit --as=<bytes> -- <cmd> <...args>. No shell: cmd+args follow `--`
    // as a plain argv, so there is no shell-injection surface.
    // 2000000 KB * 1024 = 2_048_000_000 bytes.
    expect(spec.args).toEqual([
      '--as=2048000000',
      '--',
      'fj',
      '--run',
      '/tmp/p.fjm',
    ]);
    // Crucially, no element is `sh`/`bash` and there is no `-c` shell script —
    // that is what kept the old wrapper off CodeQL's command-injection radar.
    expect(spec.args).not.toContain('-c');
    expect(spec.cmd).not.toMatch(/^(sh|bash)$/);
  });
});
