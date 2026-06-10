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

  it('never wraps on Windows even when a limit is set', async () => {
    const withResourceLimit = await load('win32', '2000000');
    expect(withResourceLimit('fj', ['x'])).toEqual({ cmd: 'fj', args: ['x'] });
  });

  it('wraps in an injection-safe sh -c ulimit shell on POSIX when set', async () => {
    const withResourceLimit = await load('linux', '2000000');
    const spec = withResourceLimit('fj', ['--run', '/tmp/p.fjm']);
    expect(spec.cmd).toBe('sh');
    // sh -c <script> <$0> <cmd> <...args>  — cmd+args are positional params,
    // never interpolated into the script string.
    expect(spec.args[0]).toBe('-c');
    expect(spec.args[1]).toContain('ulimit -v 2000000');
    expect(spec.args[1]).toContain('exec "$@"');
    expect(spec.args.slice(2)).toEqual(['sh', 'fj', '--run', '/tmp/p.fjm']);
    // The real argv must NOT appear inside the script string (no injection).
    expect(spec.args[1]).not.toContain('/tmp/p.fjm');
  });
});
