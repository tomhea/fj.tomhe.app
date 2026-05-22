import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { StringDecoder } from 'string_decoder';
import { v4 as uuidv4 } from 'uuid';
import { isSafeFilename } from './lib/safe-filename';
import { sanitizeStderr } from './lib/sanitize-stderr';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = parseInt(process.env.PORT ?? '3000', 10);

const FJ_CMD = process.env.FJ_CMD ?? 'fj';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_STDIN_BYTES = 1 * 1024 * 1024;
// Cumulative stdin cap per connection — prevents a long-lived run being
// flooded with 1 MB chunks until memory is exhausted.
const MAX_STDIN_TOTAL_BYTES = 64 * 1024 * 1024;
const RUN_TIMEOUT_MS = 5 * 60 * 1000;
const KILL_GRACE_MS = 2_000;
const WS_MAX_PAYLOAD = 4 * 1024 * 1024;

// Concurrency caps — each connection can spawn an fj subprocess on demand,
// so without a limit a small number of clients can exhaust CPU/RAM/FDs.
// Overridable via env for staging or load-testing.
const MAX_CONNECTIONS_PER_IP = parseInt(
  process.env.WS_MAX_CONNECTIONS_PER_IP ?? '4',
  10,
);
const MAX_TOTAL_CONNECTIONS = parseInt(
  process.env.WS_MAX_TOTAL_CONNECTIONS ?? '32',
  10,
);

// REST API rate limit — per IP, sliding window. Overridable via env.
// Applies to all /api/* routes before Next.js handles them.
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT ?? '20', 10);
const API_RATE_WINDOW_MS = 60_000;
const apiRateLimiter = new Map<string, { count: number; reset: number }>();

// Evict stale rate-limit entries every 5 minutes. Without this, a unique-IP
// flood leaves one Map entry per source address and grows until OOM.
const _rateLimiterSweep = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of apiRateLimiter) {
    if (now > entry.reset) apiRateLimiter.delete(ip);
  }
}, 5 * 60_000).unref();

function checkApiRateLimit(ip: string): boolean {
  const now = Date.now();
  let entry = apiRateLimiter.get(ip);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + API_RATE_WINDOW_MS };
    apiRateLimiter.set(ip, entry);
  }
  if (entry.count >= API_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// In-memory connection accounting. Process-local — when running behind
// multiple workers, an external store (Redis) would be needed instead.
const perIpConnections = new Map<string, number>();
let totalConnections = 0;

// Set TRUST_PROXY=1 when running behind a reverse proxy that strips and
// re-adds X-Forwarded-For. Without it, XFF is ignored and the socket
// address is used — prevents per-IP limits from being bypassed by
// spoofing the header on a direct-to-internet deployment.
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

function clientIp(req: IncomingMessage): string {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}

// Comma-separated list, or default to local dev origins + the deploy host.
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .concat([
      `http://${hostname}:${port}`,
      'http://localhost:3000',
      'https://fj.tomhe.app',
    ]),
);

interface RunFjMsg {
  type: 'run_fj';
  files: Array<{ name: string; content: string }>;
  initialStdin?: string;
}
interface RunFjmMsg {
  type: 'run_fjm';
  fjmBase64: string;
  initialStdin?: string;
}
interface StdinMsg {
  type: 'stdin';
  stdin: string;
}
interface KillMsg {
  type: 'kill';
}
type ClientMsg = RunFjMsg | RunFjmMsg | StdinMsg | KillMsg;

type ServerMsg =
  | { type: 'started' }
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number | null; signal?: string | null }
  | { type: 'error'; data: string };

// Strict runtime shape check. Without this, fields like msg.stdin can be
// non-string and crash the process when passed to Buffer.byteLength.
function isValidMessage(m: unknown): m is ClientMsg {
  if (!m || typeof m !== 'object') return false;
  const msg = m as Record<string, unknown>;
  switch (msg.type) {
    case 'run_fj':
      return (
        Array.isArray(msg.files) &&
        msg.files.every(
          (f) =>
            f && typeof f === 'object' &&
            typeof (f as { name?: unknown }).name === 'string' &&
            typeof (f as { content?: unknown }).content === 'string',
        ) &&
        (msg.initialStdin === undefined || typeof msg.initialStdin === 'string')
      );
    case 'run_fjm':
      return (
        typeof msg.fjmBase64 === 'string' &&
        (msg.initialStdin === undefined || typeof msg.initialStdin === 'string')
      );
    case 'stdin':
      return typeof msg.stdin === 'string';
    case 'kill':
      return true;
    default:
      return false;
  }
}

async function handleRunConnection(ws: WebSocket): Promise<void> {
  let proc: ChildProcess | null = null;
  // Synchronous lock against two awaited run_* messages racing past the
  // `if (proc) return` guard and both spawning children. Set before the
  // first await, cleared in finally.
  let starting = false;
  // Set when 'kill' arrives during the starting window (proc not yet
  // assigned). The run_* path checks this right before attachProc and
  // skips the spawn so the client doesn't end up with an orphan running.
  let pendingKill = false;
  let tempDir: string | null = null;
  let runTimeout: NodeJS.Timeout | null = null;
  let killTimeout: NodeJS.Timeout | null = null;
  let stdinBytesTotal = 0;

  function send(msg: ServerMsg): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function cleanup(): void {
    if (runTimeout) {
      clearTimeout(runTimeout);
      runTimeout = null;
    }
    if (killTimeout) {
      clearTimeout(killTimeout);
      killTimeout = null;
    }
    if (proc && !proc.killed) {
      const p = proc;
      proc = null;
      p.kill('SIGTERM');
      // Force kill if the process ignores SIGTERM. unref() so a stuck
      // child doesn't keep the event loop alive at shutdown.
      killTimeout = setTimeout(() => {
        if (!p.killed) p.kill('SIGKILL');
      }, KILL_GRACE_MS);
      killTimeout.unref?.();
    }
    if (tempDir) {
      rm(tempDir, { recursive: true, force: true }).catch(() => {});
      tempDir = null;
    }
  }

  function attachProc(child: ChildProcess, initialStdin?: string): void {
    proc = child;
    send({ type: 'started' });
    if (initialStdin && child.stdin?.writable) {
      child.stdin.write(initialStdin);
    }

    // UTF-8 decoders so multi-byte chars split across chunks don't corrupt
    // into U+FFFD replacement characters.
    const outDec = new StringDecoder('utf8');
    const errDec = new StringDecoder('utf8');

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = outDec.write(chunk);
      if (text) send({ type: 'stdout', data: text });
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = errDec.write(chunk);
      if (text) send({ type: 'stderr', data: sanitizeStderr(text) });
    });

    child.on('close', (code, signal) => {
      const tailOut = outDec.end();
      if (tailOut) send({ type: 'stdout', data: tailOut });
      const tailErr = errDec.end();
      if (tailErr) send({ type: 'stderr', data: sanitizeStderr(tailErr) });
      send({ type: 'exit', code, signal });
      proc = null;
      if (runTimeout) {
        clearTimeout(runTimeout);
        runTimeout = null;
      }
    });

    child.on('error', (err) => {
      send({ type: 'error', data: `Failed to start process: ${err.message}` });
      proc = null;
      // Node's `'close'` may or may not fire after `'error'`. If it doesn't,
      // the runTimeout would later fire on whatever proc is current then —
      // potentially killing an unrelated subsequent run. Clear it here too.
      if (runTimeout) {
        clearTimeout(runTimeout);
        runTimeout = null;
      }
    });

    runTimeout = setTimeout(() => {
      send({ type: 'error', data: 'Process timed out after 5 minutes.' });
      cleanup();
    }, RUN_TIMEOUT_MS);
  }

  ws.on('message', async (raw: RawData) => {
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        send({ type: 'error', data: 'Invalid message.' });
        return;
      }
      if (!isValidMessage(parsed)) {
        send({ type: 'error', data: 'Invalid message shape.' });
        return;
      }
      const msg = parsed;

      if (msg.type === 'run_fj') {
        if (proc || starting) {
          send({ type: 'error', data: 'A process is already running.' });
          return;
        }
        starting = true;
        try {
          if (!msg.files.length) {
            send({ type: 'error', data: 'No files provided.' });
            return;
          }
          if (msg.files.length > MAX_FILES) {
            send({ type: 'error', data: `Too many files (max ${MAX_FILES}).` });
            return;
          }
          if (msg.initialStdin && Buffer.byteLength(msg.initialStdin) > MAX_STDIN_BYTES) {
            send({ type: 'error', data: 'Stdin too large.' });
            return;
          }
          // Pre-validate filenames/sizes before mkdir so a bad payload
          // doesn't leak a tempdir.
          let total = 0;
          for (const file of msg.files) {
            if (!isSafeFilename(file.name)) {
              send({ type: 'error', data: `Unsafe filename: ${file.name}` });
              return;
            }
            const size = Buffer.byteLength(file.content);
            if (size > MAX_FILE_BYTES) {
              send({ type: 'error', data: `File too large: ${file.name}` });
              return;
            }
            total += size;
            if (total > MAX_TOTAL_BYTES) {
              send({ type: 'error', data: 'Combined file size exceeds limit.' });
              return;
            }
          }

          tempDir = join(tmpdir(), `fj-run-${uuidv4()}`);
          await mkdir(tempDir, { recursive: true });

          const paths: string[] = [];
          for (const file of msg.files) {
            const p = join(tempDir, file.name);
            await writeFile(p, file.content, 'utf8');
            paths.push(p);
          }

          if (pendingKill) {
            // A kill arrived during the starting window. Don't spawn.
            if (tempDir) {
              rm(tempDir, { recursive: true, force: true }).catch(() => {});
              tempDir = null;
            }
            send({ type: 'exit', code: null, signal: null });
          } else {
            // Real fj CLI: `fj <files…>` assembles AND runs in one step (default).
            attachProc(
              spawn(FJ_CMD, paths, { cwd: tempDir, stdio: ['pipe', 'pipe', 'pipe'] }),
              msg.initialStdin,
            );
          }
        } catch (err) {
          if (tempDir) {
            rm(tempDir, { recursive: true, force: true }).catch(() => {});
            tempDir = null;
          }
          send({ type: 'error', data: `Setup error: ${(err as Error).message}` });
        } finally {
          starting = false;
          pendingKill = false;
        }
      } else if (msg.type === 'run_fjm') {
        if (proc || starting) {
          send({ type: 'error', data: 'A process is already running.' });
          return;
        }
        starting = true;
        try {
          if (!msg.fjmBase64) {
            send({ type: 'error', data: 'No FJM content.' });
            return;
          }
          if (msg.initialStdin && Buffer.byteLength(msg.initialStdin) > MAX_STDIN_BYTES) {
            send({ type: 'error', data: 'Stdin too large.' });
            return;
          }

          tempDir = join(tmpdir(), `fj-run-${uuidv4()}`);
          await mkdir(tempDir, { recursive: true });
          const fjmPath = join(tempDir, 'program.fjm');
          await writeFile(fjmPath, Buffer.from(msg.fjmBase64, 'base64'));
          if (pendingKill) {
            // A kill arrived during the starting window. Don't spawn.
            if (tempDir) {
              rm(tempDir, { recursive: true, force: true }).catch(() => {});
              tempDir = null;
            }
            send({ type: 'exit', code: null, signal: null });
          } else {
            // Real fj CLI: `fj --run <prog.fjm>`.
            attachProc(
              spawn(FJ_CMD, ['--run', fjmPath], {
                cwd: tempDir,
                stdio: ['pipe', 'pipe', 'pipe'],
              }),
              msg.initialStdin,
            );
          }
        } catch (err) {
          if (tempDir) {
            rm(tempDir, { recursive: true, force: true }).catch(() => {});
            tempDir = null;
          }
          send({ type: 'error', data: `Setup error: ${(err as Error).message}` });
        } finally {
          starting = false;
          pendingKill = false;
        }
      } else if (msg.type === 'stdin') {
        const chunkBytes = Buffer.byteLength(msg.stdin);
        if (chunkBytes > MAX_STDIN_BYTES) {
          send({ type: 'error', data: 'Stdin chunk too large.' });
          return;
        }
        stdinBytesTotal += chunkBytes;
        if (stdinBytesTotal > MAX_STDIN_TOTAL_BYTES) {
          send({ type: 'error', data: 'Total stdin limit exceeded.' });
          cleanup();
          ws.close();
          return;
        }
        if (proc?.stdin?.writable) {
          proc.stdin.write(msg.stdin);
        }
      } else if (msg.type === 'kill') {
        if (proc) {
          // Kill the running process.  child.on('close') will emit the exit
          // event once the OS confirms termination — prevents a double-exit
          // race where cleanup() + the close handler both send 'exit'.
          cleanup();
        } else if (starting) {
          // Spawn is in flight (between mkdir/writeFile and attachProc).
          // Defer the kill — the run_* handler checks pendingKill right
          // before calling attachProc and aborts the spawn.
          pendingKill = true;
        } else {
          // Idle — send a synthetic exit so the client's kill/exit
          // handshake completes without hanging.
          send({ type: 'exit', code: null, signal: null });
        }
      }
    } catch (err) {
      // Last line of defense: any future code path that throws must not
      // crash the process and drop every other connection.
      send({ type: 'error', data: 'Internal handler error.' });
      console.error('[ws] message handler error:', err);
    }
  });

  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

function isAllowedOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    // No Origin header → non-browser client or same-origin curl. Allow in
    // dev (postman/wscat workflows), block in prod.
    return dev;
  }
  return ALLOWED_ORIGINS.has(origin);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const url = parse(req.url!, true);
    if (url.pathname?.startsWith('/api/')) {
      const ip = clientIp(req);
      if (!checkApiRateLimit(ip)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Too many requests.' }));
        return;
      }
    }
    handle(req, res, url);
  });

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: WS_MAX_PAYLOAD,
  });
  wss.on('connection', handleRunConnection);

  httpServer.on('upgrade', (req, socket, head) => {
    const url = parse(req.url ?? '', true);
    if (url.pathname !== '/ws/run') {
      socket.destroy();
      return;
    }
    if (!isAllowedOrigin(req)) {
      socket.destroy();
      return;
    }

    // Connection limits. Reply with HTTP 429 before completing the WS
    // handshake so well-behaved clients see a clear status code.
    const ip = clientIp(req);
    const ipCount = perIpConnections.get(ip) ?? 0;
    if (totalConnections >= MAX_TOTAL_CONNECTIONS || ipCount >= MAX_CONNECTIONS_PER_IP) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }

    totalConnections++;
    perIpConnections.set(ip, ipCount + 1);

    wss.handleUpgrade(req, socket, head, (ws) => {
      // Decrement on close — keep counters honest even if the runner errors
      // before/after spawn.
      ws.once('close', () => {
        totalConnections = Math.max(0, totalConnections - 1);
        const n = (perIpConnections.get(ip) ?? 1) - 1;
        if (n <= 0) perIpConnections.delete(ip);
        else perIpConnections.set(ip, n);
      });
      wss.emit('connection', ws, req);
    });
  });

  // Graceful shutdown so orphan fj processes get a chance to clean up.
  function shutdown(): void {
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5_000).unref();
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Defense in depth: keep the worker alive if anything escapes the
  // per-handler try/catch. Logged-only, no exit.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> FlipJump Interpreter ready at http://${hostname}:${port}`);
  });
});
