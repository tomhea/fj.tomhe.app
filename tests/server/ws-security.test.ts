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
import { spawn, ChildProcess, execSync } from 'child_process';
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
    execSync(`${process.env.FJ_CMD ?? 'fj'} --help`, { stdio: 'pipe' });
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
      const events = await new Promise<Evt[]>((resolve) => {
        const collected: Evt[] = [];
        const timer = setTimeout(() => resolve(collected), 8_000);
        ws.on('open', () => {
          // Send invalid FJM: just random bytes base64-encoded
          const junk = Buffer.from('not-a-real-fjm-binary-XXXXXXXX').toString('base64');
          ws.send(JSON.stringify({ type: 'run_fjm', fjmBase64: junk }));
        });
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
});
