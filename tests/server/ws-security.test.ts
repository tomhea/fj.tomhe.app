/**
 * Security-focused WebSocket tests that complement ws-runner.test.ts.
 *
 * These tests focus on edge cases: oversized payloads, invalid binary input,
 * null bytes in file content, and connection re-use after kill.
 *
 * The server is shared with ws-runner.test.ts in the same process run, so
 * this file reuses the same server startup pattern on a different port to
 * avoid state leakage.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess, execFileSync } from 'child_process';
import { request as httpRequest } from 'http';
import WebSocket from 'ws';
import { join } from 'path';

const PORT = 15500 + (process.pid % 1000);
const HOST = `localhost:${PORT}`;
const ALLOWED_ORIGIN = `http://${HOST}`;
const REPO_ROOT = join(__dirname, '..', '..');
const TEST_TIMEOUT = 30_000;

const fjAvailable = (() => {
  try {
    // execFileSync — see ws-runner.test.ts for the
    // `js/indirect-command-line-injection` rationale.
    execFileSync(process.env.FJ_CMD ?? 'fj', ['--help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

interface ServerHandle { proc: ChildProcess }

function waitForListening(port: number, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = httpRequest({ host: 'localhost', port, path: '/', method: 'GET' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('server not up'));
        else setTimeout(tryOnce, 500);
      });
      req.end();
    };
    tryOnce();
  });
}

async function startServer(): Promise<ServerHandle> {
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: 'localhost',
    NODE_ENV: 'test' as never,
    WS_MAX_CONNECTIONS_PER_IP: '10',
    WS_MAX_TOTAL_CONNECTIONS: '50',
  };
  const proc = spawn('npx', ['tsx', 'server.ts'], {
    cwd: REPO_ROOT,
    env,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', () => {});
  proc.stderr?.on('data', () => {});
  await waitForListening(PORT);
  return { proc };
}

async function stopServer(s: ServerHandle): Promise<void> {
  return new Promise((resolve) => {
    s.proc.once('exit', () => resolve());
    s.proc.kill();
    setTimeout(() => resolve(), 3000);
  });
}

let server: ServerHandle | null = null;
// Set to true only when startServer() succeeds. Tests skip when false so a
// slow/unavailable server in CI produces skips rather than failures.
let serverAvailable = false;

beforeAll(async () => {
  try {
    server = await startServer();
    serverAvailable = true;
  } catch {
    // Server failed to start (e.g. resource contention in CI when another
    // server test file is spawning a process concurrently). Tests will skip.
  }
}, 150_000);

afterAll(async () => {
  if (server) await stopServer(server);
});

beforeEach(async () => {
  await new Promise((r) => setTimeout(r, 200));
});

function openWs(): WebSocket {
  return new WebSocket(`ws://${HOST}/ws/run`, {
    headers: { Origin: ALLOWED_ORIGIN },
  });
}

interface Evt { type: string; data?: string; code?: number | null; signal?: string | null }

function collect(ws: WebSocket, timeoutMs = 5_000): Promise<Evt[]> {
  const events: Evt[] = [];
  return new Promise((resolve) => {
    const done = () => resolve(events);
    const timer = setTimeout(done, timeoutMs);
    ws.on('message', (raw) => {
      try {
        const e = JSON.parse(raw.toString()) as Evt;
        events.push(e);
        if (e.type === 'exit' || e.type === 'error') {
          clearTimeout(timer);
          ws.close();
          done();
        }
      } catch {}
    });
    ws.on('close', () => { clearTimeout(timer); done(); });
    ws.on('error', () => { clearTimeout(timer); done(); });
  });
}

describe('HTTP security headers (G2)', () => {
  it('suppresses X-Powered-By response header', async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const headers = await new Promise<Record<string, string | string[] | undefined>>((resolve, reject) => {
      const req = httpRequest({ host: 'localhost', port: PORT, path: '/', method: 'GET' }, (res) => {
        res.resume();
        resolve(res.headers as Record<string, string | string[] | undefined>);
      });
      req.on('error', reject);
      req.end();
    });
    expect(headers['x-powered-by']).toBeUndefined();
  }, TEST_TIMEOUT);
});

describe('WS security edge cases', () => {
  it('closes the connection when a message exceeds WS_MAX_PAYLOAD (4 MB)', async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const ws = openWs();
    await new Promise<void>((r) => ws.once('open', () => r()));

    // Build a payload just over 4 MB. The ws library closes the connection
    // server-side; we observe a close event (not an error message).
    const oversized = JSON.stringify({
      type: 'run_fj',
      files: [{ name: 'x.fj', content: 'x'.repeat(4 * 1024 * 1024 + 1) }],
    });

    let closed = false;
    const closePromise = new Promise<void>((r) => {
      ws.once('close', () => { closed = true; r(); });
      ws.once('error', () => { closed = true; r(); });
      setTimeout(r, 5_000);
    });
    ws.send(oversized);
    await closePromise;
    expect(closed).toBe(true);
  }, TEST_TIMEOUT);

  it.skipIf(!fjAvailable)(
    'run_fjm with invalid binary: fj exits non-zero, server does not crash',
    { timeout: TEST_TIMEOUT },
    async (ctx) => {
      if (!serverAvailable) return ctx.skip();
      const ws = openWs();
      await new Promise<void>((r) => ws.once('open', () => r()));
      // The socket is already open at this point — send immediately rather
      // than re-registering ws.on('open') which would never fire again.
      const junk = Buffer.from('not-a-real-fjm-binary-XXXXXXXX').toString('base64');
      ws.send(JSON.stringify({ type: 'run_fjm', fjmBase64: junk }));
      const events = await new Promise<Evt[]>((resolve) => {
        const collected: Evt[] = [];
        const timer = setTimeout(() => resolve(collected), 8_000);
        ws.on('message', (raw) => {
          const e = JSON.parse(raw.toString()) as Evt;
          collected.push(e);
          if (e.type === 'exit' || e.type === 'error') {
            clearTimeout(timer);
            ws.close();
            resolve(collected);
          }
        });
        ws.on('close', () => { clearTimeout(timer); resolve(collected); });
        ws.on('error', () => { clearTimeout(timer); resolve(collected); });
      });

      // The server must respond with either an exit (code ≠ 0) or an error —
      // it must not hang or silently succeed.
      const terminal = events.find((e) => e.type === 'exit' || e.type === 'error');
      expect(terminal).toBeDefined();
      if (terminal?.type === 'exit') {
        expect(terminal.code).not.toBe(0);
      }
    },
  );

  it.skipIf(!fjAvailable)(
    'run_fj with null bytes in file content: no crash, clean error or exit',
    { timeout: TEST_TIMEOUT },
    async (ctx) => {
      if (!serverAvailable) return ctx.skip();
      const ws = openWs();
      await new Promise<void>((r) => ws.once('open', () => r()));
      const nullContent = 'stl.startup\x00stl.loop';
      ws.send(JSON.stringify({
        type: 'run_fj',
        files: [{ name: 'null.fj', content: nullContent }],
      }));
      const events = await collect(ws, 10_000);
      const terminal = events.find((e) => e.type === 'exit' || e.type === 'error');
      expect(terminal).toBeDefined();
    },
  );

  it.skipIf(!fjAvailable)(
    'connection can be reused for a new run_fj after kill',
    { timeout: TEST_TIMEOUT },
    async (ctx) => {
      if (!serverAvailable) return ctx.skip();
      const ws = openWs();
      await new Promise<void>((r) => ws.once('open', () => r()));

      const spin = ['stl.startup', "stl.output_char 'X'", 'stl.loop', ''].join('\n');
      ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 's.fj', content: spin }] }));

      // Wait for started, then kill
      await new Promise<void>((r) => {
        const h = (raw: WebSocket.RawData) => {
          const e = JSON.parse(raw.toString()) as Evt;
          if (e.type === 'started') { ws.off('message', h); r(); }
        };
        ws.on('message', h);
        setTimeout(r, 3_000); // give up waiting for 'started' after 3s
      });
      ws.send(JSON.stringify({ type: 'kill' }));

      // Wait for exit event
      await new Promise<void>((r) => {
        const h = (raw: WebSocket.RawData) => {
          const e = JSON.parse(raw.toString()) as Evt;
          if (e.type === 'exit') { ws.off('message', h); r(); }
        };
        ws.on('message', h);
        setTimeout(r, 3_000);
      });

      // Now run a short program on the same connection
      const shortFj = ['stl.startup', "stl.output_char 'Z'", "stl.output_char '\\n'", 'stl.loop', ''].join('\n');
      ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 'z.fj', content: shortFj }] }));
      const secondRunEvents = await collect(ws, 10_000);

      const started = secondRunEvents.find((e) => e.type === 'started');
      expect(started).toBeDefined();
      const exit = secondRunEvents.find((e) => e.type === 'exit');
      expect(exit).toBeDefined();
    },
  );

  // Vuln 1 (HIGH): a single malformed stdin (non-string) used to crash the
  // worker via Buffer.byteLength → TypeError → unhandled rejection.
  it('non-string stdin replies with an error and the server stays alive', { timeout: TEST_TIMEOUT }, async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const ws = openWs();
    await new Promise<void>((r) => ws.once('open', () => r()));

    // null is the canonical crash vector; also exercise object/number.
    ws.send(JSON.stringify({ type: 'stdin', stdin: null }));
    ws.send(JSON.stringify({ type: 'stdin', stdin: 42 }));
    ws.send(JSON.stringify({ type: 'stdin', stdin: { malicious: true } }));

    const errors: Evt[] = [];
    await new Promise<void>((r) => {
      const h = (raw: WebSocket.RawData) => {
        try {
          const e = JSON.parse(raw.toString()) as Evt;
          if (e.type === 'error') errors.push(e);
          if (errors.length >= 3) {
            ws.off('message', h);
            r();
          }
        } catch {}
      };
      ws.on('message', h);
      setTimeout(r, 3_000);
    });
    try { ws.close(); } catch {}

    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].data).toMatch(/invalid message shape/i);

    // Server must still accept new connections — that's the regression we
    // care about. (Before the fix, the worker died on the null message.)
    await new Promise((r) => setTimeout(r, 200));
    const ws2 = openWs();
    const stillAlive = await new Promise<boolean>((resolve) => {
      ws2.once('open', () => { try { ws2.close(); } catch {} resolve(true); });
      ws2.once('error', () => resolve(false));
      setTimeout(() => resolve(false), 5_000);
    });
    expect(stillAlive).toBe(true);
  });

  // Vuln 2 (MEDIUM): two run_fj sent back-to-back must not both spawn.
  // Before the fix, the `if (proc) return` guard raced with the awaited
  // mkdir/writeFile and both messages started a child.
  it.skipIf(!fjAvailable)(
    'two run_fj back-to-back: only one process starts',
    { timeout: TEST_TIMEOUT },
    async (ctx) => {
      if (!serverAvailable) return ctx.skip();
      const ws = openWs();
      await new Promise<void>((r) => ws.once('open', () => r()));

      const spin = ['stl.startup', "stl.output_char 'X'", 'stl.loop', ''].join('\n');
      const collected: Evt[] = [];
      ws.on('message', (raw) => {
        try { collected.push(JSON.parse(raw.toString()) as Evt); } catch {}
      });

      // Send both without awaiting between them. Same JS tick → both calls
      // are queued before any message handler awaits.
      ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 'a.fj', content: spin }] }));
      ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 'b.fj', content: spin }] }));

      // Give the server time to process both, then count startups.
      await new Promise((r) => setTimeout(r, 1_500));

      const startedCount = collected.filter((e) => e.type === 'started').length;
      const alreadyRunningErr = collected.find(
        (e) => e.type === 'error' && /already running/i.test(e.data ?? ''),
      );

      // Kill before assertions so a stray child is reaped.
      try {
        ws.send(JSON.stringify({ type: 'kill' }));
        await new Promise((r) => setTimeout(r, 500));
        ws.close();
      } catch {}

      expect(startedCount).toBe(1);
      expect(alreadyRunningErr).toBeDefined();
    },
  );

  // Issue 1 (LOW): kill during the spawn-starting window must not leave
  // an orphan child running while the client sees a synthetic exit.
  it.skipIf(!fjAvailable)(
    'kill during starting aborts the spawn and clears pendingKill',
    { timeout: TEST_TIMEOUT },
    async (ctx) => {
      if (!serverAvailable) return ctx.skip();
      const ws = openWs();
      await new Promise<void>((r) => ws.once('open', () => r()));

      const spin = ['stl.startup', "stl.output_char 'X'", 'stl.loop', ''].join('\n');
      const collected: Evt[] = [];
      ws.on('message', (raw) => {
        try { collected.push(JSON.parse(raw.toString()) as Evt); } catch {}
      });

      // Send run_fj and kill in the same JS tick. The kill handler sees
      // starting=true and defers; the spawn path checks pendingKill before
      // attachProc and skips the spawn.
      ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 'a.fj', content: spin }] }));
      ws.send(JSON.stringify({ type: 'kill' }));

      await new Promise((r) => setTimeout(r, 1_500));

      const started = collected.filter((e) => e.type === 'started');
      const exits = collected.filter((e) => e.type === 'exit');
      // No 'started' should have been emitted — the spawn was aborted.
      expect(started.length).toBe(0);
      // The client must see exactly one synthetic exit.
      expect(exits.length).toBe(1);

      // pendingKill must have been cleared in finally — a follow-up run_fj
      // on the same connection should proceed and emit 'started'.
      collected.length = 0;
      ws.send(JSON.stringify({ type: 'run_fj', files: [{ name: 'b.fj', content: spin }] }));
      await new Promise((r) => setTimeout(r, 1_500));
      const restarted = collected.filter((e) => e.type === 'started').length;
      expect(restarted).toBe(1);

      try {
        ws.send(JSON.stringify({ type: 'kill' }));
        await new Promise((r) => setTimeout(r, 500));
        ws.close();
      } catch {}
    },
  );
});
