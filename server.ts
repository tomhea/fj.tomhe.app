import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = parseInt(process.env.PORT ?? '3000', 10);

// Override these via environment variables to point to your installed tools.
const FJ_CMD = process.env.FJ_CMD ?? 'fj';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
const RUN_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes

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

// Validate that a filename is safe (no path traversal, only .fj extension)
function isSafeFilename(name: string): boolean {
  return /^[\w][\w. -]*\.fj$/i.test(name) && !name.includes('..');
}

async function handleRunConnection(ws: WebSocket): Promise<void> {
  let proc: ChildProcess | null = null;
  let tempDir: string | null = null;
  let timeout: NodeJS.Timeout | null = null;

  function send(msg: ServerMsg): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function cleanup(): void {
    if (timeout) { clearTimeout(timeout); timeout = null; }
    if (proc && !proc.killed) { proc.kill('SIGTERM'); proc = null; }
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

    child.stdout?.on('data', (chunk: Buffer) => send({ type: 'stdout', data: chunk.toString() }));
    child.stderr?.on('data', (chunk: Buffer) => send({ type: 'stderr', data: chunk.toString() }));

    child.on('close', (code, signal) => {
      send({ type: 'exit', code, signal });
      proc = null;
      if (timeout) { clearTimeout(timeout); timeout = null; }
    });

    child.on('error', (err) => {
      send({ type: 'error', data: `Failed to start process: ${err.message}` });
      proc = null;
    });

    timeout = setTimeout(() => {
      send({ type: 'error', data: 'Process timed out after 5 minutes.' });
      cleanup();
    }, RUN_TIMEOUT_MS);
  }

  ws.on('message', async (raw: RawData) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString()) as ClientMsg;
    } catch {
      send({ type: 'error', data: 'Invalid message.' });
      return;
    }

    if (msg.type === 'run_fj') {
      if (proc) { send({ type: 'error', data: 'A process is already running.' }); return; }
      if (!msg.files?.length) { send({ type: 'error', data: 'No files provided.' }); return; }
      if (msg.files.length > MAX_FILES) {
        send({ type: 'error', data: `Too many files (max ${MAX_FILES}).` }); return;
      }

      try {
        tempDir = join(tmpdir(), `fj-run-${uuidv4()}`);
        await mkdir(tempDir, { recursive: true });

        const paths: string[] = [];
        for (const file of msg.files) {
          if (!isSafeFilename(file.name)) {
            send({ type: 'error', data: `Unsafe filename: ${file.name}` }); return;
          }
          if (Buffer.byteLength(file.content) > MAX_FILE_BYTES) {
            send({ type: 'error', data: `File too large: ${file.name}` }); return;
          }
          const p = join(tempDir, file.name);
          await writeFile(p, file.content, 'utf8');
          paths.push(p);
        }

        attachProc(
          spawn(FJ_CMD, ['asm_run', ...paths], { cwd: tempDir, stdio: ['pipe', 'pipe', 'pipe'] }),
          msg.initialStdin,
        );
      } catch (err) {
        send({ type: 'error', data: `Setup error: ${(err as Error).message}` });
      }

    } else if (msg.type === 'run_fjm') {
      if (proc) { send({ type: 'error', data: 'A process is already running.' }); return; }
      if (!msg.fjmBase64) { send({ type: 'error', data: 'No FJM content.' }); return; }

      try {
        tempDir = join(tmpdir(), `fj-run-${uuidv4()}`);
        await mkdir(tempDir, { recursive: true });
        const fjmPath = join(tempDir, 'program.fjm');
        await writeFile(fjmPath, Buffer.from(msg.fjmBase64, 'base64'));
        attachProc(
          spawn(FJ_CMD, ['run', fjmPath], { cwd: tempDir, stdio: ['pipe', 'pipe', 'pipe'] }),
          msg.initialStdin,
        );
      } catch (err) {
        send({ type: 'error', data: `Setup error: ${(err as Error).message}` });
      }

    } else if (msg.type === 'stdin') {
      if (proc?.stdin?.writable) {
        proc.stdin.write((msg as StdinMsg).stdin);
      }

    } else if (msg.type === 'kill') {
      cleanup();
      send({ type: 'exit', code: null, signal: 'SIGKILL' });
    }
  });

  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url!, true));
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws/run' });
  wss.on('connection', handleRunConnection);

  httpServer.listen(port, hostname, () => {
    console.log(`> FlipJump Interpreter ready at http://${hostname}:${port}`);
  });
});
