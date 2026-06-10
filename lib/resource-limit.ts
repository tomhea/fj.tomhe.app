/**
 * Optional per-subprocess memory cap for the fj / c2fj / bf2fj runners.
 *
 * The runners spawn user-controlled programs (arbitrary FlipJump / C / BF) as
 * the service user. Timeouts and the connection / job semaphores bound *how
 * many* and *how long*, but not *how much memory* a single run can allocate —
 * a deliberately memory-hungry program can drive the Python interpreter to
 * exhaust host RAM (OOM DoS).
 *
 * When `FJ_MEMORY_LIMIT_KB` is set to a positive integer on a POSIX deploy,
 * `withResourceLimit` wraps the command so it runs under `ulimit -v` (RLIMIT_AS,
 * virtual address space in KB). Each run then fails cleanly on over-allocation
 * instead of taking down the box.
 *
 * Safe-by-default: the limit is OFF unless the env var is set, and is never
 * applied on Windows (no `sh` / `ulimit`) so local dev is unaffected. The
 * operator picks a value tested against real programs — Python reserves a large
 * virtual region up front, so this must be generous (e.g. 2_000_000 = ~2 GB),
 * which is why there is no baked-in default. See README deployment notes.
 *
 * Injection-safe: the command and its arguments are passed to `sh` as positional
 * parameters (`"$@"`), never interpolated into the script string. `exec`
 * replaces the shell in-place, so the spawned child keeps the same PID — kill
 * signals, stdio pipes, and the timeout logic all continue to target the real
 * process, and no orphan shell is left behind.
 */
import { platform } from 'os';

const LIMIT_KB = parseInt(process.env.FJ_MEMORY_LIMIT_KB ?? '0', 10);

export interface SpawnSpec {
  cmd: string;
  args: string[];
}

export function withResourceLimit(cmd: string, args: string[]): SpawnSpec {
  if (!Number.isFinite(LIMIT_KB) || LIMIT_KB <= 0 || platform() === 'win32') {
    return { cmd, args };
  }
  // `ulimit -v` may fail if the requested value is below the shell's own
  // baseline — swallow that error and still exec, so a misconfigured limit
  // degrades to "no limit" rather than a broken runner.
  const script = `ulimit -v ${LIMIT_KB} 2>/dev/null; exec "$@"`;
  // sh -c SCRIPT $0 $1 $2 ...  →  inside, "$@" == [cmd, ...args]
  return { cmd: 'sh', args: ['-c', script, 'sh', cmd, ...args] };
}
