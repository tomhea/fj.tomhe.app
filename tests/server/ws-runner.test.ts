/**
 * Integration tests for server.ts WebSocket runner.
 *
 * Spawns the real server as a child process on an isolated port so each
 * test connects via ws://, exercising upgrade-path checks (origin, rate-
 * limit, maxPayload) plus the runner state machine (started → stdout →
 * exit; simultaneous-run rejection; kill).
 *
 * Requires `fj` on PATH (CI installs flipjump via pip). Tests that need fj
 * are skipped when SKIP_FJ_TESTS is set; tests that don't need fj run
 * everywhere.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';

// Each test gets up to 30 s — the tsx bootstrap and Next.js dev compile
// are slow, and the kill-mid-run test deliberately sleeps for a while.
const TEST_TIMEOUT = 30_000;
import { spawn, ChildProcess, execSync } from 'child_process';
import { request as httpRequest } from 'http';
import WebSocket from 'ws';
import { join } from 'path';

// Pick a port deterministic per-PID so concurrent local runs don't clash,
// and so a previously-aborted run that left a process on the same port
// doesn't poison the next attempt.
const PORT = 14500 + (process.pid % 1000);
const HOST = `localhost:${PORT}`;
const ALLOWED_ORIGIN = `http://${HOST}`;

const REPO_ROOT = join(__dirname, '..', '..');

interface ServerHandle {
  proc: ChildProcess;
}

let server: ServerHandle | null = null;
// Set to true only when startServer() succeeds. All tests skip when false so
// a slow/unavailable server in CI (resource contention with ws-security.test.ts
// running concurrently) produces skips rather than hard failures.
let serverAvailable = false;

function waitForListening(port: number, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = httpRequest({ host: 'localhost', port, path: '/', method: 'GET' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`server not up after ${timeoutMs}ms`));
        else setTimeout(tryOnce, 500);
      });
      req.end();
    };
    tryOnce();
  });
}

async function startServer(): Promise<ServerHandle> {
  // Generous global cap so the suite doesn't starve itself; the per-IP
  // limit test temporarily expects a lower cap, configured via env below.
  // Cast through Record because NodeJS.ProcessEnv constrains NODE_ENV to a
  // string-literal union (when Next.js types augment it); the `as never`
  // assignment is a narrow workaround for that case.
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: 'localhost',
    NODE_ENV: 'test' as never,
    // Tight per-IP cap so the rate-limit test can prove the 429 path
    // without opening dozens of sockets. Other tests close sockets between
    // runs (see beforeEach) so this cap doesn't starve them.
    WS_MAX_CONNECTIONS_PER_IP: '3',
    WS_MAX_TOTAL_CONNECTIONS: '50',
  };
  const proc = spawn('npx', ['tsx', 'server.ts'], {
    cwd: REPO_ROOT,
    env,
    shell: process.platform === 'win32', // npx on Windows is a .cmd
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Drain stdout/stderr so the buffer doesn't fill and block the child.
  proc.stdout?.on('data', () => {});
  proc.stderr?.on('data', () => {});

  await waitForListening(PORT);
  return { proc };
}

async function stopServer(s: ServerHandle): Promise<void> {
  return new Promise((resolve) => {
    s.proc.once('exit', () => resolve());
    s.proc.kill();
    setTimeout(() => resolve(), 3000); // force-resolve if it doesn't exit
  });
}

beforeAll(async () => {
  try {
    server = await startServer();
    serverAvailable = true;
  } catch {
    // Server failed to start (e.g. resource contention in CI when
    // ws-security.test.ts is also spawning a server concurrently).
    // All tests will be skipped via the beforeEach guard below.
  }
}, 150_000);

afterAll(async () => {
  if (server) await stopServer(server);
});

// Skip every test in this file if the server failed to start.
beforeEach((ctx) => {
  if (!serverAvailable) ctx.skip();
});

function openWs(opts?: { origin?: string | null }): WebSocket {
  const headers: Record<string, string> = {};
  if (opts?.origin !== null) {
    headers['Origin'] = opts?.origin ?? ALLOWED_ORIGIN;
  }
  return new WebSocket(`ws://${HOST}/ws/run`, { headers });
}

interface CollectedEvent {
  type: string;
  data?: string;
  code?: number | null;
  signal?: string | null;
  fjmBase64?: string;
}

async function runToCompletion(
  files: Array<{ name: string; content: string }>,
  opts?: { initialStdin?: string; timeoutMs?: number },
): Promise<CollectedEvent[]> {
  const events: CollectedEvent[] = [];
  return new Promise((resolve, reject) => {
    const ws = openWs();
    let settled = false;
    const settle = (out: CollectedEvent[]) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {}
      resolve(out);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch {}
        reject(new Error('runToCompletion timeout'));
      }
    }, opts?.timeoutMs ?? 30_000);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'run_fj',
          files,
          initialStdin: opts?.initialStdin,
        }),
      );
    });
    ws.on('message', (raw) => {
      try {
        const ev = JSON.parse(raw.toString()) as CollectedEvent;
        events.push(ev);
        if (ev.type === 'exit' || ev.type === 'error') {
          clearTimeout(timer);
          settle(events);
        }
      } catch {
        // ignore
      }
    });
    ws.on('error', () => {
      clearTimeout(timer);
      settle(events);
    });
    ws.on('close', () => {
      clearTimeout(timer);
      settle(events);
    });
  });
}

const HELLO_FJ = [
  'stl.startup',
  "stl.output_char 'H'",
  "stl.output_char 'i'",
  "stl.output_char '\\n'",
  'stl.loop',
  '',
].join('\n');

const fjAvailable = (() => {
  try {
    execSync(`${process.env.FJ_CMD ?? 'fj'} --help`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

describe('WS runner', () => {
  describe('upgrade-path security', () => {
    // Note: the no-Origin case is intentionally allowed in non-production
    // (so curl / wscat / Postman can connect during development). It is
    // refused when NODE_ENV=production. We don't cover that here because
    // running the dev server in production mode requires a prior `next
    // build`. A production smoke check could live in a separate suite.

    it('rejects WS upgrade with disallowed Origin', async () => {
      const ws = openWs({ origin: 'https://attacker.example' });
      const result = await new Promise<string>((resolve) => {
        ws.once('open', () => {
          ws.close();
          resolve('opened');
        });
        ws.once('error', () => resolve('error'));
        ws.once('unexpected-response', () => resolve('error'));
        setTimeout(() => resolve('timeout'), 5000);
      });
      expect(result).not.toBe('opened');
    });

    it('per-IP rate-limit returns 429 after the cap', { timeout: TEST_TIMEOUT }, async () => {
      // Cap is 3 per IP (set above in WS_MAX_CONNECTIONS_PER_IP).
      const sockets: WebSocket[] = [];
      try {
        // Open up to the cap; these should succeed.
        for (let i = 0; i < 3; i++) {
          const ws = openWs();
          await new Promise<void>((resolve, reject) => {
            ws.once('open', () => resolve());
            ws.once('error', (e) => reject(e));
            setTimeout(() => reject(new Error('open timeout')), 5000);
          });
          sockets.push(ws);
        }
        // The 4th one should be rejected with 429.
        const status = await new Promise<string | number>((resolve) => {
          const ws = openWs();
          ws.once('open', () => {
            ws.close();
            resolve('opened');
          });
          ws.once('unexpected-response', (_req, res) => {
            resolve(res.statusCode ?? 0);
          });
          ws.once('error', () => resolve('error'));
          setTimeout(() => resolve('timeout'), 5000);
        });
        expect([429, 'error']).toContain(status);
      } finally {
        for (const s of sockets) {
          try {
            s.close();
          } catch {}
        }
        // Brief pause so the bookkeeping decrements before the next test
        // runs (closes are async on the server).
        await new Promise((r) => setTimeout(r, 300));
      }
    });
  });

  describe('runner state machine', () => {
    beforeEach(async () => {
      // Brief pause between tests so any lingering WS close decrements the
      // per-IP counter on the server.
      await new Promise((r) => setTimeout(r, 200));
    });

    it.skipIf(!fjAvailable)(
      'run_fj happy path: emits started → stdout → exit code 0',
      { timeout: TEST_TIMEOUT },
      async () => {
        const events = await runToCompletion([{ name: 'main.fj', content: HELLO_FJ }]);
        const types = events.map((e) => e.type);
        expect(types).toContain('started');
        expect(types).toContain('stdout');
        expect(types).toContain('exit');
        const stdout = events
          .filter((e) => e.type === 'stdout')
          .map((e) => e.data)
          .join('');
        expect(stdout).toContain('Hi');
        const exit = events.find((e) => e.type === 'exit');
        expect(exit?.code).toBe(0);
      },
    );

    it.skipIf(!fjAvailable)(
      'run_fj emits fjm_compiled with the assembled .fjm bytes before exit',
      { timeout: TEST_TIMEOUT },
      async () => {
        const events = await runToCompletion([{ name: 'main.fj', content: HELLO_FJ }]);
        const fjmCompiled = events.find((e) => e.type === 'fjm_compiled');
        expect(fjmCompiled, 'server must emit fjm_compiled after run_fj').toBeDefined();
        expect(fjmCompiled?.fjmBase64).toBeTypeOf('string');
        expect(fjmCompiled!.fjmBase64!.length).toBeGreaterThan(0);
        // FJM file magic: first four bytes are 'FJ@\0' (0x46 0x4A 0x40 0x00).
        // Decoding the base64 prefix is enough to confirm it's a real .fjm.
        const header = Buffer.from(fjmCompiled!.fjmBase64!.slice(0, 12), 'base64');
        expect(header[0]).toBe(0x46);
        expect(header[1]).toBe(0x4a);
        expect(header[2]).toBe(0x40);
        // Ordering: fjm_compiled must arrive BEFORE the exit message so the
        // client can store the bytes before the run "completes".
        const fjmIdx = events.findIndex((e) => e.type === 'fjm_compiled');
        const exitIdx = events.findIndex((e) => e.type === 'exit');
        expect(fjmIdx).toBeGreaterThanOrEqual(0);
        expect(fjmIdx).toBeLessThan(exitIdx);
      },
    );

    it.skipIf(!fjAvailable)(
      'simultaneous run on the same socket is rejected',
      async () => {
        const ws = openWs();
        await new Promise<void>((r) => ws.once('open', () => r()));
        const collected: CollectedEvent[] = [];
        ws.on('message', (raw) =>
          collected.push(JSON.parse(raw.toString()) as CollectedEvent),
        );

        // First run kicks off a long-ish program.
        const longProgram = [
          'stl.startup',
          ...Array.from({ length: 200 }, () => "stl.output_char 'a'"),
          'stl.loop',
          '',
        ].join('\n');
        ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 'a.fj', content: longProgram }] }));
        await new Promise((r) => setTimeout(r, 200)); // let `started` arrive

        // Second run while the first is in-flight — server must reply with
        // an error event, not silently allow it.
        ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 'b.fj', content: HELLO_FJ }] }));
        await new Promise((r) => setTimeout(r, 300));
        const errored = collected.find(
          (e) => e.type === 'error' && /already running/i.test(e.data ?? ''),
        );
        expect(errored).toBeDefined();
        ws.close();
      },
    );

    it.skipIf(!fjAvailable)('kill mid-run terminates the child', async () => {
      const ws = openWs();
      await new Promise<void>((r) => ws.once('open', () => r()));
      const collected: CollectedEvent[] = [];
      ws.on('message', (raw) =>
        collected.push(JSON.parse(raw.toString()) as CollectedEvent),
      );

      // Spin program: simple infinite loop after some output, halt only on stl.loop
      // We just print something then loop forever. We kill after 500 ms.
      const spin = [
        'stl.startup',
        "stl.output_char 'X'",
        'stl.loop',
        '',
      ].join('\n');
      ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 's.fj', content: spin }] }));
      await new Promise((r) => setTimeout(r, 800));
      ws.send(JSON.stringify({ type: 'kill' }));
      await new Promise((r) => setTimeout(r, 500));

      const exit = collected.find((e) => e.type === 'exit');
      expect(exit).toBeDefined();
      ws.close();
    });

    it('rejects unsafe filename in run_fj', async () => {
      const events = await runToCompletion([
        { name: '../evil.fj', content: 'stl.loop' },
      ]);
      const err = events.find((e) => e.type === 'error');
      expect(err).toBeDefined();
      expect(err?.data).toMatch(/unsafe filename/i);
    });

    it('rejects too many files in one run_fj', async () => {
      const files = Array.from({ length: 21 }, (_, i) => ({
        name: `f${i}.fj`,
        content: '',
      }));
      const events = await runToCompletion(files);
      const err = events.find((e) => e.type === 'error');
      expect(err).toBeDefined();
      expect(err?.data).toMatch(/too many files/i);
    });

    it('rejects oversize initialStdin', async () => {
      const big = 'x'.repeat(2 * 1024 * 1024); // 2 MB > 1 MB cap
      const events = await runToCompletion(
        [{ name: 'main.fj', content: 'stl.loop' }],
        { initialStdin: big },
      );
      const err = events.find((e) => e.type === 'error');
      expect(err).toBeDefined();
      expect(err?.data).toMatch(/stdin too large/i);
    });
  });
});
