/**
 * Optional per-subprocess memory cap for the fj / c2fj / bf2fj runners.
 *
 * The runners spawn user-controlled programs (arbitrary FlipJump / C / BF) as
 * the service user. Timeouts and the connection / job semaphores bound *how
 * many* and *how long*, but not *how much memory* a single run can allocate —
 * a deliberately memory-hungry program can drive the Python interpreter to
 * exhaust host RAM (OOM DoS).
 *
 * When `FJ_MEMORY_LIMIT_KB` is set to a positive integer on a Linux deploy,
 * `withResourceLimit` rewrites the command to run under `prlimit` (util-linux),
 * which sets RLIMIT_AS (virtual address space) and then `exec`s the target
 * directly. Each run then fails cleanly on over-allocation instead of taking
 * down the box.
 *
 * Why `prlimit` and not `sh -c 'ulimit -v N; exec "$@"'`: prlimit execs the
 * command itself — there is NO shell, so the command and its arguments are
 * passed as a plain argv array exactly like an unwrapped `spawn`. That keeps
 * this off CodeQL's `js/command-line-injection` radar (a `sh -c` form trips it
 * even when the argv is passed positionally and is in fact injection-safe).
 * prlimit also preserves the child PID, stdio, and signal delivery, so the
 * runner's kill / stdin-forwarding / timeout logic is unaffected.
 *
 * Safe-by-default: the limit is OFF unless the env var is set, and is only
 * applied on Linux (prlimit is util-linux; absent on macOS/Windows), so local
 * dev is unaffected. The operator picks a value tested against real programs —
 * Python reserves a large virtual region up front, so this must be generous
 * (e.g. 2_000_000 = ~2 GB), which is why there is no baked-in default. See
 * README deployment notes.
 */
import { platform } from 'os';

const LIMIT_KB = parseInt(process.env.FJ_MEMORY_LIMIT_KB ?? '0', 10);

export interface SpawnSpec {
  cmd: string;
  args: string[];
}

export function withResourceLimit(cmd: string, args: string[]): SpawnSpec {
  if (!Number.isFinite(LIMIT_KB) || LIMIT_KB <= 0 || platform() !== 'linux') {
    return { cmd, args };
  }
  // RLIMIT_AS takes bytes; FJ_MEMORY_LIMIT_KB is KB. A single value sets both
  // the soft and hard limit. `--` terminates prlimit's own options so the
  // target command/args that follow are never parsed as prlimit flags.
  const bytes = LIMIT_KB * 1024;
  return { cmd: 'prlimit', args: [`--as=${bytes}`, '--', cmd, ...args] };
}
